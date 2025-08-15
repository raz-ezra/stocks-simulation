import { Grant } from '../types';
import { hasMetSection102HoldingPeriod, calculateSection102Tax } from './section102';

// Israeli tax brackets for 2024/2025
const TAX_BRACKETS = [
  { min: 0, max: 79560, rate: 0.10 },
  { min: 79560, max: 114120, rate: 0.14 },
  { min: 114120, max: 177360, rate: 0.20 },
  { min: 177360, max: 247440, rate: 0.31 },
  { min: 247440, max: 514920, rate: 0.35 },
  { min: 514920, max: 663240, rate: 0.47 },
  { min: 663240, max: Infinity, rate: 0.50 },
];

export interface TaxSettings {
  marginalTaxRate: number | null;
  annualIncome: number | null;
  useProgressiveTax: boolean;
}

export interface TaxCalculationResult {
  grossGain: number;
  totalTax: number;
  netGain: number;
  effectiveTaxRate: number;
  breakdown?: {
    ordinaryIncomeTax?: number;
    capitalGainsTax?: number;
    progressiveTaxAmount?: number;
    marginalTaxAmount?: number;
  };
}

/**
 * Calculate progressive tax on an amount
 */
export const calculateProgressiveTax = (income: number): number => {
  let tax = 0;
  let remainingIncome = income;
  
  for (const bracket of TAX_BRACKETS) {
    if (remainingIncome <= 0) break;
    
    const bracketIncome = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += bracketIncome * bracket.rate;
    remainingIncome -= bracketIncome;
    
    if (bracket.max === Infinity) break;
  }
  
  return tax;
};

/**
 * Calculate additional tax on top of existing income using progressive brackets
 */
export const calculateAdditionalProgressiveTax = (
  baseIncome: number, 
  additionalIncome: number
): number => {
  const taxWithAdditional = calculateProgressiveTax(baseIncome + additionalIncome);
  const taxWithoutAdditional = calculateProgressiveTax(baseIncome);
  return taxWithAdditional - taxWithoutAdditional;
};

/**
 * Get marginal tax rate at a specific income level
 */
export const getMarginalTaxRate = (income: number): number => {
  for (const bracket of TAX_BRACKETS) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate;
    }
  }
  return TAX_BRACKETS[TAX_BRACKETS.length - 1].rate;
};

/**
 * Calculate tax for RSUs based on user settings and grant details
 */
export const calculateRSUTax = (
  grant: Grant,
  shares: number,
  currentPrice: number,
  taxSettings: TaxSettings,
  usdToIls: number = 3.65,
  exerciseDate: Date = new Date()
): TaxCalculationResult => {
  const grossGain = shares * currentPrice;
  
  // Convert USD to ILS for tax calculation
  const grossGainIls = grossGain * usdToIls;
  
  let totalTax = 0;
  let breakdown: TaxCalculationResult['breakdown'] = {};
  
  // Check if this is Section 102 and if holding period is met
  const isSection102 = grant.isSection102 !== false;
  const isEligibleForSection102 = isSection102 && hasMetSection102HoldingPeriod(grant, exerciseDate);
  
  if (isEligibleForSection102) {
    // Use Section 102 calculation
    const section102Tax = calculateSection102Tax(
      grant,
      currentPrice,
      shares,
      taxSettings.marginalTaxRate || getMarginalTaxRate(taxSettings.annualIncome || 0)
    );
    
    totalTax = section102Tax.totalTax * usdToIls; // Convert back to ILS for internal calculation
    breakdown.ordinaryIncomeTax = section102Tax.ordinaryIncomeTax * usdToIls;
    breakdown.capitalGainsTax = section102Tax.capitalGainsTax * usdToIls;
  } else {
    // Regular RSU tax calculation (treated as ordinary income)
    if (taxSettings.useProgressiveTax) {
      if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
        // Calculate additional tax on top of existing income
        totalTax = calculateAdditionalProgressiveTax(taxSettings.annualIncome, grossGainIls);
        breakdown.progressiveTaxAmount = totalTax;
      } else {
        // Calculate tax as if RSU is only income (simplified progressive)
        totalTax = calculateProgressiveTax(grossGainIls);
        breakdown.progressiveTaxAmount = totalTax;
      }
    } else if (taxSettings.marginalTaxRate !== null) {
      // Use fixed marginal rate
      totalTax = grossGainIls * taxSettings.marginalTaxRate;
      breakdown.marginalTaxAmount = totalTax;
    } else {
      // Fallback to 47% rate
      totalTax = grossGainIls * 0.47;
      breakdown.marginalTaxAmount = totalTax;
    }
  }
  
  // Convert tax back to USD for result
  const totalTaxUsd = totalTax / usdToIls;
  const netGain = grossGain - totalTaxUsd;
  const effectiveTaxRate = grossGain > 0 ? totalTaxUsd / grossGain : 0;
  
  return {
    grossGain,
    totalTax: totalTaxUsd,
    netGain,
    effectiveTaxRate,
    breakdown: Object.keys(breakdown).length > 0 ? {
      ...breakdown,
      // Convert breakdown amounts back to USD
      ordinaryIncomeTax: breakdown.ordinaryIncomeTax ? breakdown.ordinaryIncomeTax / usdToIls : undefined,
      capitalGainsTax: breakdown.capitalGainsTax ? breakdown.capitalGainsTax / usdToIls : undefined,
      progressiveTaxAmount: breakdown.progressiveTaxAmount ? breakdown.progressiveTaxAmount / usdToIls : undefined,
      marginalTaxAmount: breakdown.marginalTaxAmount ? breakdown.marginalTaxAmount / usdToIls : undefined,
    } : undefined
  };
};

/**
 * Calculate tax for Options based on user settings and grant details
 */
export const calculateOptionTax = (
  grant: Grant,
  shares: number,
  currentPrice: number,
  taxSettings: TaxSettings,
  usdToIls: number = 3.65,
  exerciseDate: Date = new Date()
): TaxCalculationResult => {
  // Only calculate if options are in the money
  if (currentPrice <= grant.price) {
    return {
      grossGain: 0,
      totalTax: 0,
      netGain: 0,
      effectiveTaxRate: 0
    };
  }
  
  const grossGain = shares * (currentPrice - grant.price);
  
  // Options are typically treated as capital gains (25% in Israel)
  // Unless it's within Section 102 holding period, then it's ordinary income
  
  const isSection102 = grant.isSection102 !== false;
  const isEligibleForSection102 = isSection102 && hasMetSection102HoldingPeriod(grant, exerciseDate);
  
  let totalTax = 0;
  let breakdown: TaxCalculationResult['breakdown'] = {};
  
  if (!isEligibleForSection102) {
    // Before Section 102 eligibility - treat as ordinary income
    const grossGainIls = grossGain * usdToIls;
    
    if (taxSettings.useProgressiveTax) {
      if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
        totalTax = calculateAdditionalProgressiveTax(taxSettings.annualIncome, grossGainIls) / usdToIls;
        breakdown.progressiveTaxAmount = totalTax;
      } else {
        totalTax = calculateProgressiveTax(grossGainIls) / usdToIls;
        breakdown.progressiveTaxAmount = totalTax;
      }
    } else if (taxSettings.marginalTaxRate !== null) {
      totalTax = grossGain * taxSettings.marginalTaxRate;
      breakdown.marginalTaxAmount = totalTax;
    } else {
      totalTax = grossGain * 0.47; // Fallback
      breakdown.marginalTaxAmount = totalTax;
    }
  } else {
    // After Section 102 eligibility - capital gains rate (25%)
    totalTax = grossGain * 0.25;
    breakdown.capitalGainsTax = totalTax;
  }
  
  const netGain = grossGain - totalTax;
  const effectiveTaxRate = grossGain > 0 ? totalTax / grossGain : 0;
  
  return {
    grossGain,
    totalTax,
    netGain,
    effectiveTaxRate,
    breakdown
  };
};

/**
 * Calculate comprehensive tax for any grant type
 */
export const calculateTaxForGrant = (
  grant: Grant,
  shares: number,
  currentPrice: number,
  taxSettings: TaxSettings,
  usdToIls: number = 3.65,
  exerciseDate: Date = new Date()
): TaxCalculationResult => {
  if (grant.type === 'RSUs') {
    return calculateRSUTax(grant, shares, currentPrice, taxSettings, usdToIls, exerciseDate);
  } else {
    return calculateOptionTax(grant, shares, currentPrice, taxSettings, usdToIls, exerciseDate);
  }
};