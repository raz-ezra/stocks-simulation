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
  type: "RSUs" | "Options";
  ticker: string;
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
        }
      : {},
  });

  // const ticker = watch('ticker'); // Currently unused

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
    const grantData = {
      amount: data.amount,
      vestingFrom: new Date(data.vestingFrom),
      grantDate: new Date(data.grantDate),
      vestingYears: data.vestingYears,
      price: data.price,
      type: data.type,
      ticker: data.ticker.toUpperCase(),
    };

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
            Grant Price (per share)
          </label>
          <input
            type="number"
            step="0.01"
            {...register("price", {
              required: "Grant price is required",
              min: { value: 0.01, message: "Price must be greater than 0" },
            })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="e.g., 21.75"
          />
          {errors.price && (
            <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Grant Date
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register("grantDate", { required: "Grant date is required" })}
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
            Vesting Start Date
          </label>
          <div className="date-input-wrapper">
            <input
              type="date"
              {...register("vestingFrom", {
                required: "Vesting start date is required",
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
