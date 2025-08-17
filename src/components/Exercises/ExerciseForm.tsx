import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useGrantsStore } from "../../stores/useGrantsStore";
import { useExercisesStore } from "../../stores/useExercisesStore";
import { useStockPricesStore } from "../../stores/useStockPricesStore";
import { useCurrencyStore } from "../../stores/useCurrencyStore";
import { useThemeStore } from "../../stores/useThemeStore";
import { useTaxSettingsStore } from "../../stores/useTaxSettingsStore";
import {
  calculateVestedShares,
  calculateExercisedShares,
  calculateESPPTax,
} from "../../utils/calculations";
import { hasMetSection102HoldingPeriod, calculateSection102Tax } from "../../utils/section102";
import { Exercise } from "../../types";
import { TaxBreakdown } from "./TaxBreakdown";

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

export const ExerciseForm: React.FC<ExerciseFormProps> = ({
  exercise,
  onSubmit,
  onCancel,
}) => {
  const grants = useGrantsStore((state) => state.grants);
  const addExercise = useExercisesStore((state) => state.addExercise);
  const updateExercise = useExercisesStore((state) => state.updateExercise);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const currentUsdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const { marginalTaxRate, annualIncome, useProgressiveTax } = useTaxSettingsStore();
  
  // State for actual net currency toggle
  const [actualNetCurrency, setActualNetCurrency] = useState<'USD' | 'ILS'>(
    exercise?.actualNetCurrency || 'USD'
  );

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
          grantId: exercise.grantId || 
            grants.find((g) => g.amount === exercise.grantAmount)?.id || "",
          exerciseDate: exercise.exerciseDate instanceof Date 
            ? exercise.exerciseDate.toISOString().split("T")[0]
            : new Date(exercise.exerciseDate).toISOString().split("T")[0],
          exercisePrice: exercise.exercisePrice,
          usdIlsRate: exercise.usdIlsRate,
          actualNet: exercise.actualNet || undefined,
          isSimulation: exercise.isSimulation || false,
        }
      : {
          grantId: "",
          usdIlsRate: currentUsdIlsRate,
          exerciseDate: new Date().toISOString().split("T")[0],
          isSimulation: false,
        },
  });

  const watchedGrantId = watch("grantId");
  const watchedAmount = watch("amount");
  const watchedExercisePrice = watch("exercisePrice");
  const watchedUsdIlsRate = watch("usdIlsRate");

  const selectedGrant = grants.find((g) => g.id === watchedGrantId);

  const availableToExercise = selectedGrant
    ? Math.floor(
        calculateVestedShares(
          selectedGrant.amount,
          selectedGrant.vestingFrom,
          selectedGrant.vestingYears,
          new Date(),
          selectedGrant.type
        )
      ) -
      calculateExercisedShares(
        selectedGrant.amount,
        exercises.filter((e) => e.id !== exercise?.id)
      )
    : 0;

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

  const calculateTaxEstimate = () => {
    if (!selectedGrant || !watchedAmount || !watchedExercisePrice) return 0;

    const amount = Number(watchedAmount);
    const exercisePrice = Number(watchedExercisePrice);
    const usdToIls = Number(watchedUsdIlsRate) || currentUsdIlsRate;

    // Check if Section 102 benefits apply (default to Section 102 if not specified)
    const isSection102 = selectedGrant.isSection102 !== false;
    const section102Track = selectedGrant.section102Track || 'capital-gains';
    const isSection102Eligible = isSection102 && 
      section102Track === 'capital-gains' &&
      hasMetSection102HoldingPeriod(selectedGrant);

    if (isSection102Eligible) {
      // Use Section 102 tax calculation
      const effectiveMarginalRate = marginalTaxRate !== null && !useProgressiveTax 
        ? marginalTaxRate 
        : 0.47; // Default to high rate if not specified
      
      const { totalTax } = calculateSection102Tax(
        selectedGrant,
        exercisePrice,
        amount,
        effectiveMarginalRate
      );
      
      return totalTax;
    }

    // Regular tax calculation (non-Section 102)
    const grossGainUSD = amount * exercisePrice;
    const grantValueUSD = amount * selectedGrant.price;
    const capitalGainUSD = grossGainUSD - grantValueUSD;

    if (selectedGrant.type === "RSUs") {
      // RSUs: Income tax on the entire gross gain
      const grossGainILS = grossGainUSD * usdToIls;
      
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
        return additionalTaxILS / usdToIls;
      }
      
      // Default: Calculate as if this is the only income (simplified)
      const taxILS = calculateIsraeliIncomeTax(grossGainILS);
      return taxILS / usdToIls;
    } else if (selectedGrant.type === "Options") {
      // Options: Capital gains tax (25%) only on the profit
      return capitalGainUSD * 0.25;
    } else if (selectedGrant.type === "ESPP") {
      // ESPP: Tax calculation depends on trustee option
      const discount = selectedGrant.esppDiscount || 0.15;
      
      // Calculate fair market value (actual market price when purchased)
      // ESPP uses lookback: purchase price is lower of start or end price minus discount
      const periodStartPrice = selectedGrant.esppPeriodStartPrice || selectedGrant.price / (1 - discount);
      const periodEndPrice = selectedGrant.price / (1 - discount); // Reverse calculate from purchase price
      const fairMarketValueAtPurchase = Math.min(periodStartPrice, periodEndPrice);
      
      // Check if holding period is met (2 years from purchase date)
      const purchaseDate = selectedGrant.purchaseDate || selectedGrant.vestingFrom;
      const monthsHeld = Math.floor(
        (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const holdingPeriodMet = monthsHeld >= 24;
      
      const withTrustee = selectedGrant.esppWithTrustee || false;
      
      const { totalTax, immediatelyTaxed, discountTax } = calculateESPPTax(
        selectedGrant.price,
        fairMarketValueAtPurchase,
        exercisePrice,
        amount,
        withTrustee,
        holdingPeriodMet
      );
      
      // For non-trustee ESPP, the discount tax was already paid at purchase
      // So we only need to account for capital gains tax when selling
      if (!withTrustee && immediatelyTaxed) {
        // Only return the capital gains portion since discount was already taxed
        return totalTax - discountTax;
      }
      
      return totalTax;
    }
    
    return 0;
  };

  const taxEstimate = calculateTaxEstimate();
  const grossGain =
    (Number(watchedAmount) || 0) * (Number(watchedExercisePrice) || 0);
  const netEstimate = grossGain - taxEstimate;

  // Auto-fill exercise price and currency rate when needed
  useEffect(() => {
    if (!exercise && selectedGrant) {
      // Auto-fill exercise price with current stock price
      const currentPrice = stockPrices[selectedGrant.ticker]?.price;
      if (currentPrice) {
        setValue("exercisePrice", currentPrice);
      }

      // Auto-fill currency rate with current rate ONLY for new exercises
      setValue("usdIlsRate", currentUsdIlsRate);
    }
  }, [selectedGrant, stockPrices, currentUsdIlsRate, exercise, setValue]);

  const onFormSubmit = (data: ExerciseFormData) => {
    if (!selectedGrant) {
      return;
    }

    const exerciseData = {
      amount: data.amount,
      grantAmount: selectedGrant.amount, // Use the selected grant's amount
      grantId: selectedGrant.id, // Add the grant ID for unique reference
      exerciseDate: new Date(data.exerciseDate),
      type: selectedGrant.type,
      grantPrice: selectedGrant.price,
      exercisePrice: data.exercisePrice,
      usdIlsRate: data.usdIlsRate,
      beforeTax: grossGain,
      calculatedNet: netEstimate,
      actualNet: data.actualNet || null,
      actualNetCurrency: data.actualNet ? actualNetCurrency : undefined,
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

  const onFormError = () => {
    // Handle form validation errors if needed
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit, onFormError)}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            Grant to Exercise
          </label>
          <select
            {...register("grantId", { required: "Please select a grant" })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white"
                : "bg-white border-gray-300 text-gray-900"
            }`}
            onChange={(e) => {
              setValue("grantId", e.target.value);
            }}
          >
            <option value="">Select a grant...</option>
            {[...grants].sort((a, b) => 
              new Date(a.grantDate).getTime() - new Date(b.grantDate).getTime()
            ).map((grant) => {
              const vested = calculateVestedShares(
                grant.amount,
                grant.vestingFrom,
                grant.vestingYears,
                new Date(),
                grant.type
              );
              const exercised = calculateExercisedShares(
                grant.amount,
                exercises
              );
              const available = vested - exercised;

              return (
                <option
                  key={grant.id}
                  value={grant.id}
                  disabled={available <= 0}
                >
                  {grant.ticker} - {grant.amount.toLocaleString()} shares (
                  {grant.type}) - Available:{" "}
                  {Math.floor(available).toLocaleString()}
                </option>
              );
            })}
          </select>
          {errors.grantId && (
            <p className="text-red-500 text-sm mt-1">
              {errors.grantId.message}
            </p>
          )}
          {selectedGrant && (
            <div
              className={`mt-2 text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              <p>
                Grant Price: ${selectedGrant.price} | Available to Exercise:{" "}
                {availableToExercise.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            Exercise Date
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register("exerciseDate", {
                required: "Exercise date is required",
              })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
              onChange={(e) => {
                setValue("exerciseDate", e.target.value);
              }}
            />
            <svg
              className={`calendar-icon ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
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
            <p className="text-red-500 text-sm mt-1">
              {errors.exerciseDate.message}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            Amount to Exercise
          </label>
          <input
            type="number"
            {...register("amount", {
              required: "Amount is required",
              min: { value: 1, message: "Amount must be at least 1" },
              ...(availableToExercise > 0 && {
                max: {
                  value: availableToExercise,
                  message: `Cannot exceed ${Math.round(
                    availableToExercise
                  )} available shares`,
                },
              }),
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="Number of shares"
            max={
              availableToExercise > 0
                ? availableToExercise.toString()
                : undefined
            }
          />
          {errors.amount && (
            <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            Exercise Price (per share)
          </label>
          <input
            type="number"
            step="0.01"
            {...register("exercisePrice", {
              required: "Exercise price is required",
              min: { value: 0.01, message: "Price must be greater than 0" },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="Exercise/sale price"
          />
          {errors.exercisePrice && (
            <p className="text-red-500 text-sm mt-1">
              {errors.exercisePrice.message}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            USD/ILS Exchange Rate on sell date
          </label>
          <input
            type="number"
            step="0.0001"
            {...register("usdIlsRate", {
              required: "Exchange rate is required",
              min: { value: 0.0001, message: "Rate must be greater than 0" },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="e.g., 3.6565"
          />
          {errors.usdIlsRate && (
            <p className="text-red-500 text-sm mt-1">
              {errors.usdIlsRate.message}
            </p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-1`}
          >
            Actual Net Amount (Optional)
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                step="0.01"
                {...register("actualNet")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
                placeholder={`Actual amount received (${actualNetCurrency})`}
              />
            </div>
            <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setActualNetCurrency('USD')}
                className={`px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${
                  actualNetCurrency === 'USD'
                    ? isDarkMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                $
              </button>
              <button
                type="button"
                onClick={() => setActualNetCurrency('ILS')}
                className={`px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${
                  actualNetCurrency === 'ILS'
                    ? isDarkMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                ₪
              </button>
            </div>
          </div>
          <p
            className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            } mt-1`}
          >
            Leave blank to use calculated estimate
          </p>
        </div>

        {/* Simulation Checkbox */}
        <div className="col-span-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isSimulation"
              {...register("isSimulation")}
              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 rounded ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700"
                  : "border-gray-300 bg-white"
              }`}
            />
            <label
              htmlFor="isSimulation"
              className={`text-sm ${
                isDarkMode ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Mark as simulation (hypothetical exercise for planning purposes)
            </label>
          </div>
          <p
            className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            } mt-1`}
          >
            Simulation exercises can be easily included/excluded from totals and
            calculations
          </p>
        </div>
      </div>

      {/* Tax Calculation Preview */}
      {selectedGrant && watchedAmount && watchedExercisePrice && (
        <div
          className={`rounded-lg p-4 border ${
            isDarkMode
              ? "bg-gray-800 border-gray-600"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <h4
            className={`text-sm font-medium ${
              isDarkMode ? "text-gray-200" : "text-gray-700"
            } mb-3`}
          >
            Tax Calculation Preview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Gross Gain (USD):
              </span>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${grossGain.toLocaleString()}</p>
            </div>
            <div>
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Estimated Tax:
              </span>
              <p className="font-semibold text-red-600">
                ${taxEstimate.toLocaleString()}
              </p>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {(() => {
                  const isSection102 = selectedGrant.isSection102 !== false;
                  const section102Track = selectedGrant.section102Track || 'capital-gains';
                  const isSection102Eligible = isSection102 && 
                    section102Track === 'capital-gains' &&
                    hasMetSection102HoldingPeriod(selectedGrant);
                  
                  if (isSection102Eligible) {
                    return "Section 102 Tax Benefits Applied";
                  }
                  
                  if (isSection102 && !hasMetSection102HoldingPeriod(selectedGrant)) {
                    return "Section 102 (not yet eligible - 2yr hold required)";
                  }
                  
                  return selectedGrant.type === "RSUs"
                    ? marginalTaxRate !== null && !useProgressiveTax
                      ? `${(marginalTaxRate * 100).toFixed(0)}% Marginal Rate`
                      : annualIncome !== null && annualIncome > 0
                      ? "Progressive (on top of income)"
                      : "Progressive Income Tax"
                    : "25% Capital Gains";
                })()}
              </p>
            </div>
            <div>
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Estimated Net (USD):
              </span>
              <p className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                ${netEstimate.toLocaleString()}
              </p>
            </div>
            <div>
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Estimated Net (ILS):
              </span>
              <p className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                ₪
                {(
                  netEstimate * (Number(watchedUsdIlsRate) || currentUsdIlsRate)
                ).toLocaleString()}
              </p>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Rate: {(Number(watchedUsdIlsRate) || currentUsdIlsRate).toFixed(4)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              <strong>Note:</strong> RSU tax is calculated using Israeli progressive income tax brackets (10%-50%). 
              This is a simplified calculation - actual tax may vary based on your total annual income, 
              Section 102 status, holding period, and other factors. Consult a tax professional for accurate calculations.
            </p>
          </div>
        </div>
      )}

      {/* Tax Breakdown */}
      {selectedGrant && watchedAmount && watchedExercisePrice && grossGain > 0 && (
        <TaxBreakdown
          grantType={selectedGrant.type}
          amount={Number(watchedAmount)}
          grantPrice={selectedGrant.price}
          exercisePrice={Number(watchedExercisePrice)}
          taxAmount={taxEstimate}
          grossGain={grossGain}
          netGain={netEstimate}
          usdIlsRate={Number(watchedUsdIlsRate) || currentUsdIlsRate}
          isSection102={selectedGrant.isSection102}
          holdingPeriodMet={hasMetSection102HoldingPeriod(selectedGrant)}
          esppDiscount={selectedGrant.esppDiscount}
          esppWithTrustee={selectedGrant.esppWithTrustee}
        />
      )}

      <div
        className={`flex justify-end space-x-3 pt-6 border-t ${
          isDarkMode ? "border-gray-600" : "border-gray-200"
        }`}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-md transition-colors duration-200 ${
              isDarkMode
                ? "text-gray-200 bg-gray-600 hover:bg-gray-500"
                : "text-gray-700 bg-gray-200 hover:bg-gray-300"
            }`}
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
          {exercise ? "Update Exercise" : "Add Exercise"}
        </button>
      </div>
    </form>
  );
};
