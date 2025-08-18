import { differenceInMonths, format } from 'date-fns';
import { Grant, Exercise } from '../types';

export const monthsDifference = (startDate: Date, endDate: Date): number => {
  return differenceInMonths(endDate, startDate);
};

export const calculateVestedShares = (
  grantAmount: number,
  vestingStart: Date,
  vestingYears: number,
  currentDate: Date = new Date(),
  grantType: 'RSUs' | 'Options' | 'ESPP' = 'RSUs'
): number => {
  // ESPP shares are typically available immediately after purchase
  if (grantType === 'ESPP') {
    // If the purchase date has passed, all shares are available
    return currentDate >= vestingStart ? grantAmount : 0;
  }
  
  const monthsVested = monthsDifference(vestingStart, currentDate);
  const quarterlyVested = Math.floor(monthsVested / 3);
  const totalQuarters = vestingYears * 4;
  
  return Math.min(grantAmount, (quarterlyVested * grantAmount) / totalQuarters);
};

export const calculateExercisedShares = (
  grantAmount: number,
  exercises: Exercise[]
): number => {
  return exercises
    .filter(exercise => exercise.grantAmount === grantAmount)
    .reduce((total, exercise) => total + exercise.amount, 0);
};

export const calculateGrantValue = (
  grant: Grant,
  currentPrice: number,
  exercises: Exercise[]
): number => {
  const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears, new Date(), grant.type);
  const exercised = calculateExercisedShares(grant.amount, exercises);
  const availableShares = vested - exercised;
  
  if (grant.type === 'RSUs') {
    return availableShares * currentPrice;
  } else if (grant.type === 'Options') {
    // Options - only valuable if current price > strike price
    return grant.price > currentPrice ? 0 : availableShares * (currentPrice - grant.price);
  } else if (grant.type === 'ESPP') {
    // ESPP value is the full current market value (you own the shares)
    return availableShares * currentPrice;
  }
  
  return 0;
};

export const calculateTotalPortfolioValue = (
  grants: Grant[],
  stockPrices: { [ticker: string]: number },
  exercises: Exercise[]
): number => {
  return grants.reduce((total, grant) => {
    const currentPrice = stockPrices[grant.ticker] || 0;
    return total + calculateGrantValue(grant, currentPrice, exercises);
  }, 0);
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatCurrencyPrecise = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return format(date, 'MMM dd, yyyy');
};

// Calculate ESPP tax based on Israeli law
// Two approaches: With Trustee (Section 102) or Without Trustee (immediate tax)
export const calculateESPPTax = (
  purchasePrice: number,              // Discounted purchase price
  fairMarketValueAtPurchase: number,  // Stock value when purchased
  salePrice: number,                  // Price when selling
  shares: number,
  withTrustee: boolean = false,       // Whether using trustee (Section 102)
  holdingPeriodMet: boolean = true,   // 2 years from purchase date
  marginalTaxRate: number = 0.47      // User's actual marginal tax rate (default to 47%)
): { discountTax: number; capitalGainsTax: number; totalTax: number; immediatelyTaxed: boolean; ordinaryIncomeAmount: number; capitalGainsAmount: number; note?: string; trusteeTaxWithheld?: number } => {
  // The benefit is the discount received
  const discountBenefit = (fairMarketValueAtPurchase - purchasePrice) * shares;
  
  // Capital appreciation from purchase date to sale date
  const capitalAppreciation = (salePrice - fairMarketValueAtPurchase) * shares;
  
  if (!withTrustee) {
    // Without Trustee: Immediate taxation at purchase
    // Discount taxed immediately as employment income at your actual marginal rate
    // This tax is paid when shares are purchased, not when sold
    const discountTax = discountBenefit * marginalTaxRate;
    
    // Future appreciation taxed as capital gains when sold (25%)
    const capitalGainsTax = Math.max(0, capitalAppreciation * 0.25);
    
    return {
      discountTax,
      capitalGainsTax,
      totalTax: discountTax + capitalGainsTax,
      immediatelyTaxed: true, // Tax on discount paid at purchase
      ordinaryIncomeAmount: discountBenefit,
      capitalGainsAmount: capitalAppreciation
    };
  } else {
    // With Trustee (Section 102): Tax deferred until sale
    // IMPORTANT: Trustee doesn't know your salary, so they withhold at maximum rate (up to 62%)
    // But you actually owe based on your real marginal tax rate
    const trusteeWithholdingRate = 0.62; // Maximum withholding rate used by trustees
    
    if (!holdingPeriodMet) {
      // Sold before 2 years: Everything taxed as employment income
      const totalGain = (salePrice - purchasePrice) * shares;
      return {
        discountTax: discountBenefit * marginalTaxRate,
        capitalGainsTax: Math.max(0, capitalAppreciation * marginalTaxRate),
        totalTax: totalGain * marginalTaxRate,
        trusteeTaxWithheld: totalGain * trusteeWithholdingRate, // What trustee actually withholds
        immediatelyTaxed: false,
        ordinaryIncomeAmount: totalGain,
        capitalGainsAmount: 0,
        note: `Trustee withholds at ${(trusteeWithholdingRate * 100).toFixed(0)}% but you owe based on your ${(marginalTaxRate * 100).toFixed(0)}% marginal rate`
      };
    } else {
      // Held 2+ years with Section 102:
      // Discount is ALWAYS ordinary income (taxed at YOUR marginal rate)
      // Only appreciation gets capital gains treatment
      const discountTax = discountBenefit * marginalTaxRate; // Your actual marginal rate on discount
      const capitalGainsTax = Math.max(0, capitalAppreciation * 0.25); // Appreciation at capital gains rate
      
      // Trustee withholds assuming maximum rate on discount and 25% on gains
      const trusteeTaxWithheld = (discountBenefit * trusteeWithholdingRate) + (capitalAppreciation * 0.25);
      
      return {
        discountTax,
        capitalGainsTax,
        totalTax: discountTax + capitalGainsTax,
        trusteeTaxWithheld, // What trustee actually takes
        immediatelyTaxed: false,
        ordinaryIncomeAmount: discountBenefit, // Ordinary income
        capitalGainsAmount: capitalAppreciation, // Capital gains
        note: `Trustee withholds ₪${trusteeTaxWithheld.toFixed(0)} (62% on discount) but you actually owe ₪${(discountTax + capitalGainsTax).toFixed(0)} based on your ${(marginalTaxRate * 100).toFixed(0)}% rate`
      };
    }
  }
};

// Calculate net value after ESPP tax
export const calculateESPPNetValue = (
  grant: Grant,
  currentPrice: number,
  exercises: Exercise[],
  marginalTaxRate: number = 0.47
): number => {
  if (grant.type !== 'ESPP') return 0;
  
  const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears, new Date(), grant.type);
  const exercised = calculateExercisedShares(grant.amount, exercises);
  const availableShares = vested - exercised;
  
  if (availableShares <= 0) return 0;
  
  // Calculate the fair market value at purchase (price without discount)
  const discount = grant.esppDiscount || 0.15;
  const fairMarketValueAtPurchase = grant.price / (1 - discount);
  
  // Check if holding period is met (2 years from grant date for Section 102)
  const holdingPeriodMet = grant.purchaseDate ? 
    monthsDifference(grant.purchaseDate, new Date()) >= 24 : false;
  
  const { totalTax } = calculateESPPTax(
    grant.price,
    fairMarketValueAtPurchase,
    currentPrice,
    availableShares,
    grant.isSection102,
    holdingPeriodMet,
    marginalTaxRate
  );
  
  const grossValue = availableShares * (currentPrice - grant.price);
  return grossValue - totalTax;
};