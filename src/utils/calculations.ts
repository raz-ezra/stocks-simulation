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
  holdingPeriodMet: boolean = true    // 2 years from purchase date
): { discountTax: number; capitalGainsTax: number; totalTax: number; immediatelyTaxed: boolean; ordinaryIncomeAmount: number; capitalGainsAmount: number; note?: string } => {
  // The benefit is the discount received
  const discountBenefit = (fairMarketValueAtPurchase - purchasePrice) * shares;
  
  // Capital appreciation from purchase date to sale date
  const capitalAppreciation = (salePrice - fairMarketValueAtPurchase) * shares;
  
  if (!withTrustee) {
    // Without Trustee: Immediate taxation at purchase
    // Discount taxed immediately as employment income (47%)
    // This tax is paid when shares are purchased, not when sold
    const discountTax = discountBenefit * 0.47;
    
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
    if (!holdingPeriodMet) {
      // Sold before 2 years: Everything taxed as employment income
      const totalGain = (salePrice - purchasePrice) * shares;
      return {
        discountTax: discountBenefit * 0.47,
        capitalGainsTax: Math.max(0, capitalAppreciation * 0.47),
        totalTax: totalGain * 0.47,
        immediatelyTaxed: false,
        ordinaryIncomeAmount: totalGain,
        capitalGainsAmount: 0
      };
    } else {
      // Held 2+ years with Section 102:
      // Discount is ALWAYS ordinary income (taxed at marginal rate)
      // Only appreciation gets capital gains treatment
      // Note: Trustee may withhold at lower rate (e.g., 25%) but you owe your actual marginal rate
      const discountTax = discountBenefit * 0.47; // Discount taxed as ordinary income at marginal rate
      const capitalGainsTax = Math.max(0, capitalAppreciation * 0.25); // Appreciation at capital gains rate
      
      return {
        discountTax,
        capitalGainsTax,
        totalTax: discountTax + capitalGainsTax,
        immediatelyTaxed: false,
        ordinaryIncomeAmount: discountBenefit, // Ordinary income
        capitalGainsAmount: capitalAppreciation, // Capital gains
        note: 'Trustee may withhold at lower rate, but discount is taxed at your marginal rate'
      };
    }
  }
};

// Calculate net value after ESPP tax
export const calculateESPPNetValue = (
  grant: Grant,
  currentPrice: number,
  exercises: Exercise[]
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
    holdingPeriodMet
  );
  
  const grossValue = availableShares * (currentPrice - grant.price);
  return grossValue - totalTax;
};