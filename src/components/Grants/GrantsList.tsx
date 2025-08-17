import React from 'react';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useStockPricesStore } from '../../stores/useStockPricesStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { calculateVestedShares, calculateExercisedShares, formatCurrency, formatCurrencyPrecise, formatDate } from '../../utils/calculations';
import { getSection102Status } from '../../utils/section102';
import { Grant } from '../../types';

interface GrantsListProps {
  onEditGrant: (grant: Grant) => void;
}

export const GrantsList: React.FC<GrantsListProps> = ({ onEditGrant }) => {
  const grants = useGrantsStore((state) => state.grants);
  const deleteGrant = useGrantsStore((state) => state.deleteGrant);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const { isDarkMode } = useThemeStore();

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this grant?')) {
      deleteGrant(id);
    }
  };

  if (grants.length === 0) {
    return (
      <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-lg mb-2">No grants added yet</p>
        <p>Add your first grant to get started</p>
      </div>
    );
  }

  // Sort grants by grant date (oldest first)
  const sortedGrants = [...grants].sort((a, b) => 
    new Date(a.grantDate).getTime() - new Date(b.grantDate).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg`}>
        <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <tr>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Stock
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Type
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Amount
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Vested
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Grant Price
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Current Value
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Grant Date
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Section 102
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
          {sortedGrants.map((grant) => {
            const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears, new Date(), grant.type);
            const exercised = calculateExercisedShares(grant.amount, exercises);
            const availableShares = vested - exercised;
            const currentPrice = stockPrices[grant.ticker]?.price || 0;
            const stockError = stockPrices[grant.ticker]?.error;
            
            let currentValue = 0;
            if (grant.type === 'RSUs') {
              currentValue = availableShares * currentPrice;
            } else if (grant.type === 'ESPP') {
              // ESPP shares are owned, show full market value
              currentValue = availableShares * currentPrice;
            } else {
              // Options show only the gain
              currentValue = currentPrice > grant.price ? availableShares * (currentPrice - grant.price) : 0;
            }

            const vestingProgress = (vested / grant.amount) * 100;

            return (
              <tr key={grant.id} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{grant.ticker}</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {stockError ? (
                        <span className="text-red-500">Price error</span>
                      ) : (
                        formatCurrency(currentPrice)
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    grant.type === 'RSUs' 
                      ? 'bg-green-100 text-green-800' 
                      : grant.type === 'ESPP'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {grant.type}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {grant.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{Math.round(vested).toLocaleString()}</div>
                    <div className={`w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded-full h-2 mt-1`}>
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(vestingProgress, 100)}%` }}
                      />
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                      {Math.round(vestingProgress)}%
                    </div>
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatCurrencyPrecise(grant.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(currentValue)}
                  </div>
                  {currentPrice > 0 && grant.price > 0 && (
                    <div className={`text-xs ${
                      currentPrice > grant.price 
                        ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                        : (isDarkMode ? 'text-red-400' : 'text-red-500')
                    }`}>
                      {currentPrice > grant.price ? '+' : ''}{((currentPrice - grant.price) / grant.price * 100).toFixed(1)}% profit
                    </div>
                  )}
                  {grant.type === 'Options' && currentPrice <= grant.price && (
                    <div className="text-xs text-red-500">Underwater</div>
                  )}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {formatDate(grant.grantDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const status = getSection102Status(grant);
                    const colorClasses = {
                      green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
                      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    };
                    return (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClasses[status.color as keyof typeof colorClasses]}`}>
                        {status.text}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onEditGrant(grant)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(grant.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};