// Service to trigger stock price fetches when grants are added
type StockPriceFetchCallback = (tickers: string[]) => void;

class StockPriceTriggerService {
  private callbacks: StockPriceFetchCallback[] = [];

  // Register a callback to be called when new tickers are added
  onNewTickers(callback: StockPriceFetchCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // Trigger all callbacks with new tickers
  triggerFetch(tickers: string[]) {
    this.callbacks.forEach(callback => {
      try {
        callback(tickers);
      } catch (error) {
        console.error('Error in stock price trigger callback:', error);
      }
    });
  }
}

// Export singleton instance
export const stockPriceTrigger = new StockPriceTriggerService();