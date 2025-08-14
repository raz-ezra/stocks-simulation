export interface StockApiResponse {
  ticker: string;
  price: number;
  success: boolean;
  error?: string;
  provider?: string;
}

import { useSettingsStore } from "../stores/useSettingsStore";

// Finnhub API configuration
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

// Get API key from settings store
const getFinnhubApiKey = (): string => {
  const settingsState = useSettingsStore.getState();
  return (
    settingsState.finnhubApiKey ||
    (import.meta as any).env?.VITE_FINNHUB_API_KEY ||
    "demo"
  );
};

// Mock data removed - only real API calls now

// Finnhub API implementation
const fetchFromFinnhub = async (ticker: string): Promise<StockApiResponse> => {
  const FINNHUB_API_KEY = getFinnhubApiKey();

  if (FINNHUB_API_KEY === "demo") {
    throw new Error("No Finnhub API key provided");
  }

  const url = `${FINNHUB_BASE_URL}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Finnhub API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  // Finnhub returns error as a string in the response
  if (typeof data === 'string' && data.includes('error')) {
    throw new Error(`Finnhub API error: ${data}`);
  }

  // Check if we have valid price data
  if (!data.c || typeof data.c !== 'number' || data.c <= 0) {
    throw new Error(`No valid price data available for ${ticker}`);
  }

  const currentPrice = parseFloat(data.c);
  // Additional data available but not used in current interface:
  // const previousClose = parseFloat(data.pc);
  // const change = parseFloat(data.d);
  // const changePercent = parseFloat(data.dp);
  // const dayHigh = parseFloat(data.h);
  // const dayLow = parseFloat(data.l);
  // const dayOpen = parseFloat(data.o);

  return {
    ticker,
    price: currentPrice,
    success: true,
    provider: "Finnhub (Real-time)"
  };
};

// Mock data provider removed - only real API calls

// Rate limiting state
interface RateLimit {
  lastCallTime: number;
  callCount: number;
}

const rateLimitState: RateLimit = {
  lastCallTime: 0,
  callCount: 0,
};

// Check if we can make an API call (30 calls per second for Finnhub)
const canMakeApiCall = (): boolean => {
  const now = Date.now();
  const oneSecond = 1000;

  // Reset counter if more than a second has passed
  if (now - rateLimitState.lastCallTime > oneSecond) {
    rateLimitState.callCount = 0;
  }

  return rateLimitState.callCount < 30;
};

// Record an API call
const recordApiCall = (): void => {
  const now = Date.now();
  rateLimitState.lastCallTime = now;
  rateLimitState.callCount++;
};

// Main function - only real API calls, no mocks
export const fetchStockPrice = async (
  ticker: string,
  forceRefresh: boolean = false
): Promise<StockApiResponse> => {
  const FINNHUB_API_KEY = getFinnhubApiKey();

  // Check if we have an API key
  if (FINNHUB_API_KEY === "demo") {
    return {
      ticker,
      price: 0,
      success: false,
      error: `No Finnhub API key configured. Add one in Settings to get real stock prices.`,
    };
  }

  // Check rate limits
  if (!forceRefresh && !canMakeApiCall()) {
    return {
      ticker,
      price: 0,
      success: false,
      error: `Rate limit exceeded for ${ticker}. Please wait before trying again.`,
    };
  }

  // Try Finnhub API
  try {
    recordApiCall();
    const result = await fetchFromFinnhub(ticker);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      ticker,
      price: 0,
      success: false,
      error: `API call failed for ${ticker}: ${errorMessage}`,
    };
  }
};

export const fetchMultipleStockPrices = async (
  tickers: string[]
): Promise<StockApiResponse[]> => {
  // Fetch with slight delays to respect API rate limits
  const results: StockApiResponse[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    // Add small delay between requests (except for first one) - Finnhub allows 30/second
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay (20/second to be safe)
    }

    const result = await fetchStockPrice(ticker);
    results.push(result);
  }

  return results;
};
