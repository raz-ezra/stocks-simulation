import { useMemo } from 'react';
import { useGrantsStore } from '../stores/useGrantsStore';
import { useExercisesStore } from '../stores/useExercisesStore';
import { useStockPricesStore } from '../stores/useStockPricesStore';
import { calculateVestedShares, calculateExercisedShares, calculateGrantValue } from '../utils/calculations';

export const useVestingCalculations = () => {
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);

  const calculations = useMemo(() => {
    return grants.map((grant) => {
      const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears);
      const exercised = calculateExercisedShares(grant.amount, exercises);
      const currentPrice = stockPrices[grant.ticker]?.price || 0;
      const currentValue = calculateGrantValue(grant, currentPrice, exercises);
      const vestingProgress = (vested / grant.amount) * 100;

      return {
        ...grant,
        vested,
        exercised,
        availableShares: vested - exercised,
        currentPrice,
        currentValue,
        vestingProgress,
        isUnderwater: grant.type === 'Options' && currentPrice <= grant.price,
      };
    });
  }, [grants, exercises, stockPrices]);

  return calculations;
};