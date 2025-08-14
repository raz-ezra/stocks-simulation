import { fetchStockPrice, StockApiResponse } from './stockApi';

interface StockPriceCache {
  isCacheValid: (ticker: string, maxAgeMinutes?: number) => boolean;
  setStockPrice: (ticker: string, price: number, provider?: string) => void;
  getStockPrice: (ticker: string) => any;
}

// Smart stock price fetching with caching
export const fetchStockPriceWithCache = async (
  ticker: string,
  cache: StockPriceCache,
  forceRefresh: boolean = false
): Promise<StockApiResponse> => {
  // Check cache first (unless force refresh)
  if (!forceRefresh && cache.isCacheValid(ticker, 5)) {
    const cachedPrice = cache.getStockPrice(ticker);
    
    // Clean the provider string and add cached indicator
    const cleanProvider = cachedPrice.provider?.replace(/ \(cached\)$/, '') || 'Unknown';
    
    return {
      ticker,
      price: cachedPrice.price,
      success: true,
      provider: `${cleanProvider} (cached)`,
    };
  }
  
  // Fetch fresh data
  const result = await fetchStockPrice(ticker, forceRefresh);
  
  // Update cache if successful
  if (result.success) {
    cache.setStockPrice(result.ticker, result.price, result.provider);
  }
  
  return result;
};

export const fetchMultipleStockPricesWithCache = async (
  tickers: string[],
  cache: StockPriceCache,
  forceRefresh: boolean = false
): Promise<StockApiResponse[]> => {
  const results: StockApiResponse[] = [];
  let apiCallsUsed = 0;
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    
    // Check if we need to fetch fresh data
    const needsRefresh = forceRefresh || !cache.isCacheValid(ticker, 5);
    
    if (needsRefresh && apiCallsUsed >= 5) {
      // Rate limit would be exceeded, using cache for remaining tickers
      const result = await fetchStockPriceWithCache(ticker, cache, false);
      results.push(result);
      continue;
    }
    
    // Add delay between API calls (not for cached requests)
    if (needsRefresh && apiCallsUsed > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const result = await fetchStockPriceWithCache(ticker, cache, forceRefresh);
    results.push(result);
    
    // Track API calls (not cached requests)
    if (result.success && result.provider && !result.provider.includes('cached')) {
      apiCallsUsed++;
    }
  }
  
  return results;
};