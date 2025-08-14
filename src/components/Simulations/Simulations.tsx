import React from 'react';
import { SimulationCalculator } from './SimulationCalculator';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useThemeStore } from '../../stores/useThemeStore';

export const Simulations: React.FC = () => {
  const grants = useGrantsStore((state) => state.grants);
  const { isDarkMode } = useThemeStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Portfolio Simulations</h2>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Model different growth scenarios and exit dates to plan your financial future
        </p>
      </div>

      {grants.length === 0 ? (
        <div className={`${isDarkMode ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'} border rounded-lg p-6 text-center`}>
          <div className={`${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>
            <h3 className="text-lg font-medium mb-2">No Grants Available</h3>
            <p className="text-sm">
              You need to add grants first before running simulations. 
              Go to the Grants section to add your stock grants.
            </p>
          </div>
        </div>
      ) : (
        <SimulationCalculator />
      )}
    </div>
  );
};