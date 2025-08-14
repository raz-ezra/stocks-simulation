export interface CurrencyApiResponse {
  rate: number;
  success: boolean;
  error?: string;
}

// Using exchangerate-api.com (free tier available)
const CURRENCY_API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

// Fallback rate in case API fails
const FALLBACK_USD_ILS_RATE = 3.65;

export const fetchUsdIlsRate = async (): Promise<CurrencyApiResponse> => {
  try {
    console.log('Fetching USD/ILS exchange rate...');
    
    const response = await fetch(CURRENCY_API_BASE_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Currency API response:', data);
    
    if (!data.rates || !data.rates.ILS) {
      throw new Error('No ILS rate found in response');
    }
    
    const rate = parseFloat(data.rates.ILS);
    console.log(`Successfully fetched USD/ILS rate: ${rate}`);
    
    return {
      rate,
      success: true,
    };
  } catch (error) {
    console.warn('Error fetching USD/ILS rate, using fallback:', error);
    return {
      rate: FALLBACK_USD_ILS_RATE,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};