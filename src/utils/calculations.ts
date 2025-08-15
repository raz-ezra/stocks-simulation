import { differenceInMonths, format } from 'date-fns';
import { Grant, Exercise } from '../types';

export const monthsDifference = (startDate: Date, endDate: Date): number => {
  return differenceInMonths(endDate, startDate);
};

export const calculateVestedShares = (
  grantAmount: number,
  vestingStart: Date,
  vestingYears: number,
  currentDate: Date = new Date()
): number => {
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
  const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears);
  const exercised = calculateExercisedShares(grant.amount, exercises);
  const availableShares = vested - exercised;
  
  if (grant.type === 'RSUs') {
    return availableShares * currentPrice;
  } else {
    // Options - only valuable if current price > strike price
    return grant.price > currentPrice ? 0 : availableShares * (currentPrice - grant.price);
  }
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