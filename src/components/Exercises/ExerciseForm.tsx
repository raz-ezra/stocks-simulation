import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useStockPricesStore } from '../../stores/useStockPricesStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { calculateVestedShares, calculateExercisedShares } from '../../utils/calculations';
import { Exercise } from '../../types';

interface ExerciseFormData {
  amount: number;
  grantId: string;
  exerciseDate: string;
  exercisePrice: number;
  usdIlsRate: number;
  actualNet?: number;
  isSimulation: boolean;
}

interface ExerciseFormProps {
  exercise?: Exercise;
  onSubmit?: () => void;
  onCancel?: () => void;
}

export const ExerciseForm: React.FC<ExerciseFormProps> = ({ exercise, onSubmit, onCancel }) => {
  const grants = useGrantsStore((state) => state.grants);
  const addExercise = useExercisesStore((state) => state.addExercise);
  const updateExercise = useExercisesStore((state) => state.updateExercise);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const currentUsdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExerciseFormData>({
    defaultValues: exercise
      ? {
          amount: exercise.amount,
          grantId: grants.find(g => g.amount === exercise.grantAmount)?.id || '',
          exerciseDate: exercise.exerciseDate.toISOString().split('T')[0],
          exercisePrice: exercise.exercisePrice,
          usdIlsRate: exercise.usdIlsRate,
          actualNet: exercise.actualNet || undefined,
          isSimulation: exercise.isSimulation || false,
        }
      : {
          grantId: '',
          usdIlsRate: currentUsdIlsRate,
          exerciseDate: new Date().toISOString().split('T')[0],
          isSimulation: false,
        },
  });

  const watchedGrantId = watch('grantId');
  const watchedAmount = watch('amount');
  const watchedExercisePrice = watch('exercisePrice');
  const watchedExerciseDate = watch('exerciseDate');
  const watchedUsdIlsRate = watch('usdIlsRate');

  const selectedGrant = grants.find(g => g.id === watchedGrantId);
  
  const availableToExercise = selectedGrant 
    ? Math.floor(calculateVestedShares(selectedGrant.amount, selectedGrant.vestingFrom, selectedGrant.vestingYears)) 
      - calculateExercisedShares(selectedGrant.amount, exercises.filter(e => e.id !== exercise?.id))
    : 0;

  const calculateTaxEstimate = () => {
    if (!selectedGrant || !watchedAmount || !watchedExercisePrice) return 0;
    
    const grossGain = Number(watchedAmount) * Number(watchedExercisePrice);
    const grantValue = Number(watchedAmount) * selectedGrant.price;
    const capitalGain = grossGain - grantValue;
    
    // Simplified Israeli tax calculation
    const taxRate = selectedGrant.type === 'RSUs' ? 0.47 : 0.25; // RSUs: income tax, Options: capital gains
    return capitalGain * taxRate;
  };

  const taxEstimate = calculateTaxEstimate();
  const grossGain = (Number(watchedAmount) || 0) * (Number(watchedExercisePrice) || 0);
  const netEstimate = grossGain - taxEstimate;

  // Auto-fill exercise price and currency rate when needed
  useEffect(() => {
    if (!exercise && selectedGrant) {
      // Auto-fill exercise price with current stock price
      const currentPrice = stockPrices[selectedGrant.ticker]?.price;
      if (currentPrice) {
        setValue('exercisePrice', currentPrice);
      }
      
      // Auto-fill currency rate with current rate
      setValue('usdIlsRate', currentUsdIlsRate);
    }
  }, [selectedGrant, stockPrices, currentUsdIlsRate, exercise, setValue]);

  const onFormSubmit = (data: ExerciseFormData) => {
    if (!selectedGrant) {
      return;
    }

    const exerciseData = {
      amount: data.amount,
      grantAmount: selectedGrant.amount, // Use the selected grant's amount
      exerciseDate: new Date(data.exerciseDate),
      type: selectedGrant.type,
      grantPrice: selectedGrant.price,
      exercisePrice: data.exercisePrice,
      usdIlsRate: data.usdIlsRate,
      beforeTax: grossGain,
      calculatedNet: netEstimate,
      actualNet: data.actualNet || null,
      isSimulation: data.isSimulation,
      includeInCalculations: data.isSimulation ? true : true, // Simulations default to included
    };

    if (exercise) {
      updateExercise(exercise.id, exerciseData);
    } else {
      addExercise(exerciseData);
    }

    onSubmit?.();
  };

  const onFormError = (errors: any) => {
    // Handle form validation errors if needed
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit, onFormError)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            Grant to Exercise
          </label>
          <select
            {...register('grantId', { required: 'Please select a grant' })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            onChange={(e) => {
              setValue('grantId', e.target.value);
            }}
          >
            <option value="">Select a grant...</option>
            {grants.map((grant) => {
              const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears);
              const exercised = calculateExercisedShares(grant.amount, exercises);
              const available = vested - exercised;
              
              return (
                <option key={grant.id} value={grant.id} disabled={available <= 0}>
                  {grant.ticker} - {grant.amount.toLocaleString()} shares ({grant.type}) 
                  - Available: {Math.floor(available).toLocaleString()}
                </option>
              );
            })}
          </select>
          {errors.grantId && (
            <p className="text-red-500 text-sm mt-1">{errors.grantId.message}</p>
          )}
          {selectedGrant && (
            <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <p>Grant Price: ${selectedGrant.price} | Available to Exercise: {availableToExercise.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            Exercise Date
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register('exerciseDate', { required: 'Exercise date is required' })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              onChange={(e) => {
                setValue('exerciseDate', e.target.value);
              }}
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
          {errors.exerciseDate && (
            <p className="text-red-500 text-sm mt-1">{errors.exerciseDate.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            Amount to Exercise
          </label>
          <input
            type="number"
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 1, message: 'Amount must be at least 1' },
              max: { 
                value: availableToExercise > 0 ? availableToExercise : undefined, 
                message: `Cannot exceed ${Math.round(availableToExercise)} available shares` 
              },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
            placeholder="Number of shares"
            max={availableToExercise > 0 ? availableToExercise : undefined}
          />
          {errors.amount && (
            <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            Exercise Price (per share)
          </label>
          <input
            type="number"
            step="0.01"
            {...register('exercisePrice', {
              required: 'Exercise price is required',
              min: { value: 0.01, message: 'Price must be greater than 0' },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
            placeholder="Exercise/sale price"
          />
          {errors.exercisePrice && (
            <p className="text-red-500 text-sm mt-1">{errors.exercisePrice.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            USD/ILS Exchange Rate
          </label>
          <input
            type="number"
            step="0.0001"
            {...register('usdIlsRate', {
              required: 'Exchange rate is required',
              min: { value: 0.0001, message: 'Rate must be greater than 0' },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
            placeholder="e.g., 3.6565"
          />
          {errors.usdIlsRate && (
            <p className="text-red-500 text-sm mt-1">{errors.usdIlsRate.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
            Actual Net Amount (Optional)
          </label>
          <input
            type="number"
            step="0.01"
            {...register('actualNet')}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
            placeholder="Actual amount received"
          />
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Leave blank to use calculated estimate</p>
        </div>

        {/* Simulation Checkbox */}
        <div className="col-span-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isSimulation"
              {...register('isSimulation')}
              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 rounded ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'}`}
            />
            <label htmlFor="isSimulation" className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Mark as simulation (hypothetical exercise for planning purposes)
            </label>
          </div>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
            Simulation exercises can be easily included/excluded from totals and calculations
          </p>
        </div>
      </div>

      {/* Tax Calculation Preview */}
      {selectedGrant && watchedAmount && watchedExercisePrice && (
        <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-3`}>Tax Calculation Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Gross Gain (USD):</span>
              <p className="font-semibold">${grossGain.toLocaleString()}</p>
            </div>
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Estimated Tax:</span>
              <p className="font-semibold text-red-600">${taxEstimate.toLocaleString()}</p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {selectedGrant.type === 'RSUs' ? '~47% (Income Tax)' : '~25% (Capital Gains)'}
              </p>
            </div>
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Estimated Net (USD):</span>
              <p className="font-semibold text-green-600">${netEstimate.toLocaleString()}</p>
            </div>
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Estimated Net (ILS):</span>
              <p className="font-semibold text-green-600">
                ₪{((netEstimate * (watchedUsdIlsRate || currentUsdIlsRate)).toLocaleString())}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Rate: {(watchedUsdIlsRate || currentUsdIlsRate).toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`flex justify-end space-x-3 pt-6 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-md transition-colors duration-200 ${isDarkMode ? 'text-gray-200 bg-gray-600 hover:bg-gray-500' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'}`}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          onClick={() => {
            // Handle submit button click if needed
          }}
        >
          {exercise ? 'Update Exercise' : 'Add Exercise'}
        </button>
      </div>
    </form>
  );
};