import React from "react";
import { useForm } from "react-hook-form";
import { useGrantsStore } from "../../stores/useGrantsStore";
import { useStockPricesStore } from "../../stores/useStockPricesStore";
import { useThemeStore } from "../../stores/useThemeStore";
import { fetchStockPrice } from "../../services/stockApi";
import { Grant } from "../../types";

interface GrantFormData {
  amount: number;
  vestingFrom: string;
  grantDate: string;
  vestingYears: number;
  price: number;
  type: "RSUs" | "Options" | "ESPP";
  ticker: string;
  isSection102: boolean;
  section102Track: "capital-gains" | "ordinary-income";
  esppDiscount?: number;
  purchaseDate?: string;
  esppPeriodStartPrice?: number;
  esppWithTrustee?: boolean;
}

interface GrantFormProps {
  grant?: Grant;
  onSubmit?: () => void;
  onCancel?: () => void;
}

export const GrantForm: React.FC<GrantFormProps> = ({
  grant,
  onSubmit,
  onCancel,
}) => {
  const addGrant = useGrantsStore((state) => state.addGrant);
  const updateGrant = useGrantsStore((state) => state.updateGrant);
  const setStockPrice = useStockPricesStore((state) => state.setStockPrice);
  const setStockPriceError = useStockPricesStore(
    (state) => state.setStockPriceError
  );
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GrantFormData>({
    defaultValues: grant
      ? {
          amount: grant.amount,
          vestingFrom: grant.vestingFrom.toISOString().split("T")[0],
          grantDate: grant.grantDate.toISOString().split("T")[0],
          vestingYears: grant.vestingYears,
          price: grant.price,
          type: grant.type,
          ticker: grant.ticker,
          isSection102: grant.isSection102 || false,
          section102Track: grant.section102Track || "capital-gains",
          esppDiscount: grant.esppDiscount,
          purchaseDate: grant.purchaseDate?.toISOString().split("T")[0],
          esppPeriodStartPrice: grant.esppPeriodStartPrice,
          esppWithTrustee: grant.esppWithTrustee,
        }
      : {
          isSection102: true,
          section102Track: "capital-gains",
          esppDiscount: 0.15,
          esppWithTrustee: false,
        },
  });

  const isSection102 = watch('isSection102');
  const grantType = watch('type');

  const fetchTickerPrice = async (tickerSymbol: string) => {
    if (!tickerSymbol || tickerSymbol.length < 1) return;

    try {
      const result = await fetchStockPrice(tickerSymbol.toUpperCase());
      if (result.success) {
        setStockPrice(result.ticker, result.price, result.provider);
        setValue("price", result.price);
      } else {
        setStockPriceError(result.ticker, result.error || "Unknown error");
      }
    } catch (error) {
      setStockPriceError(tickerSymbol, "Failed to fetch price");
    }
  };

  const handleTickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTicker = event.target.value.toUpperCase();
    setValue("ticker", newTicker);

    if (newTicker.length >= 1) {
      // Debounce the API call
      const timeoutId = setTimeout(() => {
        fetchTickerPrice(newTicker);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  };

  const onFormSubmit = (data: GrantFormData) => {
    const grantData: any = {
      amount: data.amount,
      vestingFrom: new Date(data.vestingFrom),
      grantDate: new Date(data.grantDate),
      vestingYears: data.vestingYears,
      price: data.price,
      type: data.type,
      ticker: data.ticker.toUpperCase(),
      isSection102: data.isSection102,
      section102Track: data.section102Track,
    };

    // Add ESPP-specific fields
    if (data.type === 'ESPP') {
      grantData.esppDiscount = data.esppDiscount || 0.15;
      grantData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date(data.vestingFrom);
      grantData.esppPeriodStartPrice = data.esppPeriodStartPrice;
      grantData.esppWithTrustee = data.esppWithTrustee || false;
    }

    if (grant) {
      updateGrant(grant.id, grantData);
    } else {
      addGrant(grantData);
    }

    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Stock Symbol
          </label>
          <input
            type="text"
            {...register("ticker", {
              required: "Stock symbol is required",
              pattern: {
                value: /^[A-Z]{1,5}$/,
                message: "Enter a valid stock symbol (1-5 letters)",
              },
            })}
            onChange={handleTickerChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="e.g., AAPL"
          />
          {errors.ticker && (
            <p className="text-red-500 text-sm mt-1">{errors.ticker.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Grant Type
          </label>
          <select
            {...register("type", { required: "Grant type is required" })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="RSUs">RSUs</option>
            <option value="Options">Options</option>
            <option value="ESPP">ESPP (Employee Stock Purchase Plan)</option>
          </select>
          {errors.type && (
            <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Amount (Shares)
          </label>
          <input
            type="number"
            {...register("amount", {
              required: "Amount is required",
              min: { value: 1, message: "Amount must be at least 1" },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="e.g., 5220"
          />
          {errors.amount && (
            <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            {grantType === 'ESPP' ? 'Purchase Price (paid with after-tax salary)' : 'Grant Price (per share)'}
          </label>
          <input
            type="number"
            step="0.001"
            {...register("price", {
              required: "Price is required",
              min: { value: 0.001, message: "Price must be greater than 0" },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder={grantType === 'ESPP' ? "e.g., 85.00 (after 15% discount)" : "e.g., 21.750"}
          />
          {errors.price && (
            <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
          )}
          {grantType === 'ESPP' && (
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Actual purchase price after discount (lower of period start/end price minus discount)
            </p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            {grantType === 'ESPP' ? 'Enrollment Date' : 'Grant Date'}
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register("grantDate", { required: grantType === 'ESPP' ? "Enrollment date is required" : "Grant date is required" })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
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
          {errors.grantDate && (
            <p className="text-red-500 text-sm mt-1">
              {errors.grantDate.message}
            </p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            {grantType === 'ESPP' ? 'Purchase Date' : 'Vesting Start Date'}
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register("vestingFrom", {
                required: grantType === 'ESPP' ? "Purchase date is required" : "Vesting start date is required",
              })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
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
          {errors.vestingFrom && (
            <p className="text-red-500 text-sm mt-1">
              {errors.vestingFrom.message}
            </p>
          )}
        </div>

        {grantType !== 'ESPP' && (
          <div className="md:col-span-2">
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Vesting Period (Years)
            </label>
            <select
              {...register("vestingYears", {
                required: "Vesting period is required",
              })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value={1}>1 Year</option>
              <option value={2}>2 Years</option>
              <option value={3}>3 Years</option>
              <option value={4}>4 Years</option>
              <option value={5}>5 Years</option>
            </select>
            {errors.vestingYears && (
              <p className="text-red-500 text-sm mt-1">
                {errors.vestingYears.message}
              </p>
            )}
          </div>
        )}

        {grantType === 'ESPP' && (
          <>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                ESPP Discount Percentage
              </label>
              <select
                {...register("esppDiscount")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={0.10}>10%</option>
                <option value={0.15}>15% (Standard)</option>
                <option value={0.20}>20%</option>
              </select>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                The discount percentage from market price
              </p>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Period Start Price (for lookback)
              </label>
              <input
                type="number"
                step="0.001"
                {...register("esppPeriodStartPrice", {
                  min: { value: 0.001, message: "Price must be greater than 0" },
                })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="e.g., 100.00"
              />
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Stock price at ESPP period start (purchase price is lower of start/end)
              </p>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="esppWithTrustee"
                  {...register("esppWithTrustee")}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="esppWithTrustee" className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  ESPP with Trustee (Section 102)
                </label>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Without Trustee: Immediate tax on discount at purchase (47%), can sell anytime<br/>
                With Trustee: Tax deferred until sale, must hold 2 years for capital gains treatment
              </p>
            </div>
            <div className="hidden">
              <input
                type="number"
                {...register("vestingYears")}
                value={0}
              />
            </div>
          </>
        )}
      </div>

      {/* Section 102 Settings */}
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="isSection102"
            {...register("isSection102")}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isSection102" className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Section 102 Grant (Israeli Tax Benefit)
          </label>
        </div>
        
        {isSection102 && (
          <div className="ml-6">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Section 102 Track
            </label>
            <select
              {...register("section102Track")}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="capital-gains">Capital Gains Track (25% tax after 2 years)</option>
              <option value="ordinary-income">Ordinary Income Track</option>
            </select>
            <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {grantType === 'ESPP' 
                ? 'ESPP Section 102 only applies if using trustee option. Without trustee, discount is taxed immediately at purchase.'
                : 'Capital Gains Track: Hold for 2 years to qualify for 25% capital gains tax on appreciation. Grant price is taxed as ordinary income.'}
            </p>
          </div>
        )}
      </div>

      <div className={`flex justify-end space-x-3 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-md transition-colors duration-200 ${
              isDarkMode
                ? 'text-gray-300 bg-gray-700 hover:bg-gray-600'
                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
        >
          {isSubmitting ? "Saving..." : grant ? "Update Grant" : "Add Grant"}
        </button>
      </div>
    </form>
  );
};
