import { differenceInMonths, differenceInDays, addYears } from 'date-fns';
import { Grant } from '../types';

// Section 102 requires 2 years (24 months) holding period for capital gains track
const SECTION_102_HOLDING_PERIOD_MONTHS = 24;

/**
 * Check if a grant has met the Section 102 holding period requirement
 * Default to Section 102 if not explicitly set (for backwards compatibility)
 */
export const hasMetSection102HoldingPeriod = (grant: Grant, currentDate: Date = new Date()): boolean => {
  // Default to Section 102 capital gains track if not specified
  const isSection102 = grant.isSection102 !== false;
  
  if (!isSection102) return false;
  
  const monthsSinceGrant = differenceInMonths(currentDate, grant.grantDate);
  return monthsSinceGrant >= SECTION_102_HOLDING_PERIOD_MONTHS;
};

/**
 * Calculate the date when Section 102 benefits become available
 */
export const getSection102EligibilityDate = (grant: Grant): Date => {
  return addYears(grant.grantDate, 2);
};

/**
 * Calculate days remaining until Section 102 eligibility
 */
export const getDaysUntilSection102Eligible = (grant: Grant, currentDate: Date = new Date()): number => {
  const isSection102 = grant.isSection102 !== false;
  if (!isSection102) return 0;
  if (hasMetSection102HoldingPeriod(grant, currentDate)) return 0;
  
  const eligibilityDate = getSection102EligibilityDate(grant);
  return Math.max(0, differenceInDays(eligibilityDate, currentDate));
};

/**
 * Calculate months remaining until Section 102 eligibility
 */
export const getMonthsUntilSection102Eligible = (grant: Grant, currentDate: Date = new Date()): number => {
  const isSection102 = grant.isSection102 !== false;
  if (!isSection102) return 0;
  if (hasMetSection102HoldingPeriod(grant, currentDate)) return 0;
  
  const monthsSinceGrant = differenceInMonths(currentDate, grant.grantDate);
  return Math.max(0, SECTION_102_HOLDING_PERIOD_MONTHS - monthsSinceGrant);
};

/**
 * Format the time remaining until Section 102 eligibility
 */
export const formatSection102TimeRemaining = (grant: Grant, currentDate: Date = new Date()): string => {
  const isSection102 = grant.isSection102 !== false;
  if (!isSection102) return 'Not Section 102';
  if (hasMetSection102HoldingPeriod(grant, currentDate)) return 'Eligible';
  
  const daysRemaining = getDaysUntilSection102Eligible(grant, currentDate);
  const monthsRemaining = Math.floor(daysRemaining / 30);
  const daysInMonth = daysRemaining % 30;
  
  if (monthsRemaining > 0) {
    return `${monthsRemaining}m ${daysInMonth}d`;
  }
  return `${daysRemaining}d`;
};

/**
 * Calculate Section 102 tax for RSUs
 * Under capital gains track:
 * - Grant price (30-day average at grant) is taxed as ordinary income
 * - Gain above grant price is taxed at 25% capital gains
 */
export const calculateSection102Tax = (
  grant: Grant,
  exercisePrice: number,
  amount: number,
  marginalTaxRate: number = 0.47
): { ordinaryIncomeTax: number; capitalGainsTax: number; totalTax: number } => {
  // Default to Section 102 capital gains track if not specified
  const isSection102 = grant.isSection102 !== false;
  const section102Track = grant.section102Track || 'capital-gains';
  
  if (!isSection102 || section102Track !== 'capital-gains') {
    // Not Section 102 or not capital gains track - regular tax calculation
    const totalGain = amount * exercisePrice;
    return {
      ordinaryIncomeTax: totalGain * marginalTaxRate,
      capitalGainsTax: 0,
      totalTax: totalGain * marginalTaxRate
    };
  }
  
  // Section 102 capital gains track calculation
  const grantValue = amount * grant.price; // Value at grant (30-day average)
  const exerciseValue = amount * exercisePrice; // Value at exercise
  const capitalGain = Math.max(0, exerciseValue - grantValue);
  
  // Grant value is taxed as ordinary income
  const ordinaryIncomeTax = grantValue * marginalTaxRate;
  
  // Capital gain is taxed at 25%
  const capitalGainsTax = capitalGain * 0.25;
  
  return {
    ordinaryIncomeTax,
    capitalGainsTax,
    totalTax: ordinaryIncomeTax + capitalGainsTax
  };
};

/**
 * Get Section 102 status display text
 */
export const getSection102Status = (grant: Grant, currentDate: Date = new Date()): {
  status: 'eligible' | 'waiting' | 'not-applicable';
  text: string;
  color: string;
} => {
  // Default to Section 102 if not explicitly set to false
  const isSection102 = grant.isSection102 !== false;
  
  if (!isSection102) {
    return {
      status: 'not-applicable',
      text: 'Not 102',
      color: 'gray'
    };
  }
  
  if (hasMetSection102HoldingPeriod(grant, currentDate)) {
    return {
      status: 'eligible',
      text: '✓',
      color: 'green'
    };
  }
  
  const timeRemaining = formatSection102TimeRemaining(grant, currentDate);
  return {
    status: 'waiting',
    text: timeRemaining,
    color: 'yellow'
  };
};