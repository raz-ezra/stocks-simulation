import { Grant } from '../types';
import { hasMetSection102HoldingPeriod } from './section102';

// Israeli tax brackets for 2025 (updated)
const TAX_BRACKETS = [
  { min: 0, max: 84120, rate: 0.10 },
  { min: 84120, max: 120720, rate: 0.14 },
  { min: 120720, max: 193800, rate: 0.20 },
  { min: 193800, max: 269280, rate: 0.31 },
  { min: 269280, max: 560280, rate: 0.35 },
  { min: 560280, max: 721560, rate: 0.47 },
  { min: 721560, max: Infinity, rate: 0.50 },
];

// National Insurance + Health tax rates for 2025 (monthly caps)
const NATIONAL_INSURANCE_BRACKETS = [
  { min: 0, max: 7522, rate: 0.0427 },      // 4.27% up to ₪7,522/month
  { min: 7522, max: 50695, rate: 0.1217 },  // 12.17% from ₪7,522-50,695/month  
  { min: 50695, max: Infinity, rate: 0 },   // 0% above ₪50,695/month
];

// Surtax threshold
const SURTAX_THRESHOLD = 721560; // ₪721,560 annually
const SURTAX_LABOR_RATE = 0.03;  // 3% on labor income above threshold
const SURTAX_PASSIVE_RATE = 0.05; // 5% total on passive income above threshold

// Capital gains rates
const CAPITAL_GAINS_RATE = 0.25;           // 25% for regular shareholders
const CAPITAL_GAINS_RATE_CONTROLLING = 0.30; // 30% for controlling shareholders (≥10%)

export interface TaxSettings {
  marginalTaxRate: number | null;
  annualIncome: number | null;
  useProgressiveTax: boolean;
  isControllingShareholder?: boolean; // ≥10% shareholder (affects CG rate)
}

export interface TaxCalculationResult {
  grossGain: number;
  totalTax: number;
  netGain: number;
  effectiveTaxRate: number;
  breakdown?: {
    incomeTax?: number;
    nationalInsurance?: number;
    capitalGainsTax?: number;
    surtax?: number;
    section102Applied?: boolean;
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
 * Calculate National Insurance + Health tax on monthly employment income
 * Uses monthly caps as per Israeli law
 */
export const calculateNationalInsuranceMonthly = (monthlyEmploymentIncomeIls: number): number => {
  let tax = 0;
  let remainingIncome = monthlyEmploymentIncomeIls;
  
  for (const bracket of NATIONAL_INSURANCE_BRACKETS) {
    if (remainingIncome <= 0) break;
    
    const bracketIncome = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += bracketIncome * bracket.rate;
    remainingIncome -= bracketIncome;
    
    if (bracket.max === Infinity) break;
  }
  
  return tax;
};

/**
 * Calculate additional National Insurance tax on top of existing monthly salary
 */
export const calculateAdditionalNationalInsurance = (
  baseMonthlySalaryIls: number,
  additionalMonthlyIncomeIls: number
): number => {
  const totalMonthly = baseMonthlySalaryIls + additionalMonthlyIncomeIls;
  const taxWithAdditional = calculateNationalInsuranceMonthly(totalMonthly);
  const taxWithoutAdditional = calculateNationalInsuranceMonthly(baseMonthlySalaryIls);
  return taxWithAdditional - taxWithoutAdditional;
};

/**
 * Calculate surtax (מס יסף) on annual income above threshold
 */
export const calculateSurtax = (
  annualLaborIncomeIls: number, 
  annualPassiveIncomeIls: number
): { laborSurtax: number; passiveSurtax: number; totalSurtax: number } => {
  const totalIncome = annualLaborIncomeIls + annualPassiveIncomeIls;
  
  if (totalIncome <= SURTAX_THRESHOLD) {
    return { laborSurtax: 0, passiveSurtax: 0, totalSurtax: 0 };
  }
  
  const excessIncome = totalIncome - SURTAX_THRESHOLD;
  
  // Labor income gets 3% surtax
  const laborExcess = Math.min(excessIncome, annualLaborIncomeIls);
  const laborSurtax = laborExcess * SURTAX_LABOR_RATE;
  
  // Passive income gets 5% total surtax (3% base + 2% additional)
  const passiveExcess = Math.max(0, excessIncome - laborExcess);
  const passiveSurtax = passiveExcess * SURTAX_PASSIVE_RATE;
  
  return {
    laborSurtax,
    passiveSurtax,
    totalSurtax: laborSurtax + passiveSurtax
  };
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
  const grantValue = shares * grant.price;
  const appreciation = grossGain - grantValue;
  
  const grossGainIls = grossGain * usdToIls;
  const grantValueIls = grantValue * usdToIls;
  const appreciationIls = appreciation * usdToIls;
  
  // Check if this is Section 102 and if holding period is met
  const isSection102 = grant.isSection102 !== false;
  const isEligibleForSection102 = isSection102 && hasMetSection102HoldingPeriod(grant, exerciseDate);
  
  let incomeTax = 0;
  let nationalInsurance = 0;
  let capitalGainsTax = 0;
  let surtax = 0;
  
  if (isEligibleForSection102 && grant.section102Track === 'capital-gains') {
    // Section 102 Capital Gains Track: 
    // - Grant value: income tax + NI (at grant)
    // - Appreciation: capital gains (25%/30%) + surtax
    
    // 1. Grant value as income tax (this was already taxed at grant, but we show it for completeness)
    if (taxSettings.useProgressiveTax) {
      if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
        incomeTax = calculateAdditionalProgressiveTax(taxSettings.annualIncome, grantValueIls);
      } else {
        incomeTax = calculateProgressiveTax(grantValueIls);
      }
    } else if (taxSettings.marginalTaxRate !== null) {
      incomeTax = grantValueIls * taxSettings.marginalTaxRate;
    } else {
      incomeTax = grantValueIls * 0.47;
    }
    
    // 2. National Insurance on grant value
    if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
      const baseMonthlySalary = taxSettings.annualIncome / 12;
      const additionalMonthlyIncome = grantValueIls / 12;
      nationalInsurance = calculateAdditionalNationalInsurance(baseMonthlySalary, additionalMonthlyIncome) * 12;
    } else {
      const monthlyAmount = grantValueIls / 12;
      nationalInsurance = calculateNationalInsuranceMonthly(monthlyAmount) * 12;
    }
    
    // 3. Capital gains tax on appreciation
    const cgRate = taxSettings.isControllingShareholder ? CAPITAL_GAINS_RATE_CONTROLLING : CAPITAL_GAINS_RATE;
    capitalGainsTax = appreciationIls * cgRate;
    
    // 4. Surtax on passive income (appreciation only)
    const surtaxResult = calculateSurtax(0, appreciationIls);
    surtax = surtaxResult.passiveSurtax;
    
    
  } else {
    // Regular RSUs or Section 102 ordinary track: entire amount as employment income
    
    // 1. Income Tax on full amount
    if (taxSettings.useProgressiveTax) {
      if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
        incomeTax = calculateAdditionalProgressiveTax(taxSettings.annualIncome, grossGainIls);
      } else {
        incomeTax = calculateProgressiveTax(grossGainIls);
      }
    } else if (taxSettings.marginalTaxRate !== null) {
      incomeTax = grossGainIls * taxSettings.marginalTaxRate;
    } else {
      incomeTax = grossGainIls * 0.47; // Fallback
    }
    
    // 2. National Insurance + Health Tax (monthly caps)
    if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
      // Calculate additional NI tax on top of existing salary
      const baseMonthlySalary = taxSettings.annualIncome / 12;
      const additionalMonthlyIncome = grossGainIls / 12;
      nationalInsurance = calculateAdditionalNationalInsurance(baseMonthlySalary, additionalMonthlyIncome) * 12;
    } else {
      // No base salary - treat as if equity is only income (simplified)
      const monthlyAmount = grossGainIls / 12;
      nationalInsurance = calculateNationalInsuranceMonthly(monthlyAmount) * 12;
    }
    
    // 3. Surtax on labor income
    const currentAnnualIncome = taxSettings.annualIncome || 0;
    const surtaxResult = calculateSurtax(currentAnnualIncome + grossGainIls, 0);
    const baselineSurtax = calculateSurtax(currentAnnualIncome, 0);
    surtax = surtaxResult.laborSurtax - baselineSurtax.laborSurtax;
  }
  
  const totalTaxIls = incomeTax + nationalInsurance + capitalGainsTax + surtax;
  const totalTaxUsd = totalTaxIls / usdToIls;
  const netGain = grossGain - totalTaxUsd;
  const effectiveTaxRate = grossGain > 0 ? totalTaxUsd / grossGain : 0;
  
  return {
    grossGain,
    totalTax: totalTaxUsd,
    netGain,
    effectiveTaxRate,
    breakdown: {
      incomeTax: incomeTax / usdToIls,
      nationalInsurance: nationalInsurance / usdToIls,
      capitalGainsTax: capitalGainsTax / usdToIls,
      surtax: surtax / usdToIls,
      section102Applied: isEligibleForSection102,
    }
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
      effectiveTaxRate: 0,
      breakdown: {
        incomeTax: 0,
        nationalInsurance: 0,
        capitalGainsTax: 0,
        surtax: 0,
        section102Applied: false,
      }
    };
  }
  
  const grossGain = shares * (currentPrice - grant.price);
  const grossGainIls = grossGain * usdToIls;
  
  const isSection102 = grant.isSection102 !== false;
  const isEligibleForSection102 = isSection102 && hasMetSection102HoldingPeriod(grant, exerciseDate);
  
  let incomeTax = 0;
  let nationalInsurance = 0;
  let capitalGainsTax = 0;
  let surtax = 0;
  
  if (isEligibleForSection102) {
    // After Section 102 eligibility - capital gains treatment
    const cgRate = taxSettings.isControllingShareholder ? CAPITAL_GAINS_RATE_CONTROLLING : CAPITAL_GAINS_RATE;
    capitalGainsTax = grossGainIls * cgRate;
    
    // Calculate surtax on passive income
    const surtaxResult = calculateSurtax(0, grossGainIls);
    surtax = surtaxResult.passiveSurtax;
  } else {
    // Before Section 102 eligibility - treat as employment income
    
    // 1. Income Tax
    if (taxSettings.useProgressiveTax) {
      if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
        incomeTax = calculateAdditionalProgressiveTax(taxSettings.annualIncome, grossGainIls);
      } else {
        incomeTax = calculateProgressiveTax(grossGainIls);
      }
    } else if (taxSettings.marginalTaxRate !== null) {
      incomeTax = grossGainIls * taxSettings.marginalTaxRate;
    } else {
      incomeTax = grossGainIls * 0.47; // Fallback
    }
    
    // 2. National Insurance + Health Tax
    if (taxSettings.annualIncome && taxSettings.annualIncome > 0) {
      // Calculate additional NI tax on top of existing salary
      const baseMonthlySalary = taxSettings.annualIncome / 12;
      const additionalMonthlyIncome = grossGainIls / 12;
      nationalInsurance = calculateAdditionalNationalInsurance(baseMonthlySalary, additionalMonthlyIncome) * 12;
    } else {
      // No base salary - treat as if equity is only income (simplified)
      const monthlyAmount = grossGainIls / 12;
      nationalInsurance = calculateNationalInsuranceMonthly(monthlyAmount) * 12;
    }
    
    // 3. Surtax on labor income
    const currentAnnualIncome = taxSettings.annualIncome || 0;
    const surtaxResult = calculateSurtax(currentAnnualIncome + grossGainIls, 0);
    const baselineSurtax = calculateSurtax(currentAnnualIncome, 0);
    surtax = surtaxResult.laborSurtax - baselineSurtax.laborSurtax;
  }
  
  const totalTaxIls = incomeTax + nationalInsurance + capitalGainsTax + surtax;
  const totalTaxUsd = totalTaxIls / usdToIls;
  const netGain = grossGain - totalTaxUsd;
  const effectiveTaxRate = grossGain > 0 ? totalTaxUsd / grossGain : 0;
  
  return {
    grossGain,
    totalTax: totalTaxUsd,
    netGain,
    effectiveTaxRate,
    breakdown: {
      incomeTax: incomeTax / usdToIls,
      nationalInsurance: nationalInsurance / usdToIls,
      capitalGainsTax: capitalGainsTax / usdToIls,
      surtax: surtax / usdToIls,
      section102Applied: isEligibleForSection102,
    }
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