export interface StockApiResponse {
  ticker: string;
  price: number;
  success: boolean;
  error?: string;
  provider?: string;
}

import { useSettingsStore } from '../stores/useSettingsStore';

// Polygon.io API configuration
const POLYGON_BASE_URL = 'https://api.polygon.io/v2';

// Get API key from settings store
const getPolygonApiKey = (): string => {
  const settingsState = useSettingsStore.getState();
  return settingsState.polygonApiKey || (import.meta as any).env?.VITE_POLYGON_API_KEY || 'demo';
};

const mockPrices: { [key: string]: number } = {
  LMND: 18.5,  // Lemonade Inc
  AAPL: 185.5,
  GOOGL: 138.25,
  MSFT: 378.85,
  TSLA: 245.8,
  NVDA: 875.3,
  META: 485.2,
  AMZN: 145.9,
  NFLX: 485.6,
  CRM: 245.8,
};

// Polygon.io API implementation
const fetchFromPolygon = async (ticker: string): Promise<StockApiResponse> => {
  const POLYGON_API_KEY = getPolygonApiKey();
  
  if (POLYGON_API_KEY === 'demo') {
    throw new Error('No Polygon.io API key provided');
  }

  // Use the previous close endpoint for reliable daily prices
  const url = `${POLYGON_BASE_URL}/aggs/ticker/${ticker}/prev?adjusted=true&apikey=${POLYGON_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Polygon API HTTP error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'OK') {
    throw new Error(`Polygon API error: ${data.error || 'Unknown error'}`);
  }
  
  if (!data.results || data.results.length === 0) {
    throw new Error(`No price data available for ${ticker}`);
  }
  
  const result = data.results[0];
  const price = parseFloat(result.c); // 'c' is the closing price
  
  if (!price || price <= 0) {
    throw new Error(`Invalid price data for ${ticker}`);
  }
  
  return {
    ticker,
    price,
    success: true,
    provider: 'Polygon.io',
  };
};

// Mock data provider (fallback)
const fetchFromMock = async (ticker: string): Promise<StockApiResponse> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  
  if (mockPrices[ticker]) {
    // Add some realistic variation
    const basePrice = mockPrices[ticker];
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const price = basePrice * (1 + variation);
    
    return {
      ticker,
      price: Math.round(price * 100) / 100,
      success: true,
      provider: 'Mock Data',
    };
  }
  
  throw new Error(`Mock price not available for ${ticker}`);
};

// Rate limiting state
interface RateLimit {
  lastCallTime: number;
  callCount: number;
}

const rateLimitState: RateLimit = {
  lastCallTime: 0,
  callCount: 0,
};

// Check if we can make an API call (5 calls per minute for Polygon.io)
const canMakeApiCall = (): boolean => {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  
  // Reset counter if more than a minute has passed
  if (now - rateLimitState.lastCallTime > oneMinute) {
    rateLimitState.callCount = 0;
  }
  
  return rateLimitState.callCount < 5;
};

// Record an API call
const recordApiCall = (): void => {
  const now = Date.now();
  rateLimitState.lastCallTime = now;
  rateLimitState.callCount++;
};

// Main function with caching and rate limiting
export const fetchStockPrice = async (ticker: string, forceRefresh: boolean = false): Promise<StockApiResponse> => {
  const POLYGON_API_KEY = getPolygonApiKey();
  
  // Try Polygon.io if we have an API key and can make a call
  if (POLYGON_API_KEY !== 'demo' && (forceRefresh || canMakeApiCall())) {
    try {
      recordApiCall();
      const result = await fetchFromPolygon(ticker);
      return result;
    } catch (error) {
      console.warn(`Polygon API failed for ${ticker}, falling back to mock data:`, error);
      // Polygon.io failed, falling back to mock data
    }
  } else if (POLYGON_API_KEY !== 'demo') {
    console.info(`Rate limit reached for ${ticker}, using mock data`);
    // Rate limit reached, using mock data
  } else {
    console.info(`No Polygon.io API key configured. Add one in Settings to get real stock prices.`);
    // No Polygon.io API key provided, using mock data
  }
  
  // Fallback to mock data
  try {
    const result = await fetchFromMock(ticker);
    return result;
  } catch (error) {
    return {
      ticker,
      price: 0,
      success: false,
      error: `No API key configured and mock price not available for ${ticker}. Add a Polygon.io API key in Settings for real prices.`,
    };
  }
};

export const fetchMultipleStockPrices = async (tickers: string[]): Promise<StockApiResponse[]> => {
  // Fetch with slight delays to respect API rate limits
  const results: StockApiResponse[] = [];
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    
    // Add small delay between requests (except for first one)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
    
    const result = await fetchStockPrice(ticker);
    results.push(result);
  }
  
  return results;
};