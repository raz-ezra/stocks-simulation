import React from 'react';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCurrency, formatDate } from '../../utils/calculations';
import { Exercise } from '../../types';

interface ExercisesListProps {
  onEditExercise: (exercise: Exercise) => void;
}

export const ExercisesList: React.FC<ExercisesListProps> = ({ onEditExercise }) => {
  const exercises = useExercisesStore((state) => state.exercises);
  const deleteExercise = useExercisesStore((state) => state.deleteExercise);
  const toggleSimulationInclusion = useExercisesStore((state) => state.toggleSimulationInclusion);
  const grants = useGrantsStore((state) => state.grants);
  const { isDarkMode } = useThemeStore();

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this exercise?')) {
      deleteExercise(id);
    }
  };

  const getGrantTicker = (grantAmount: number): string => {
    const grant = grants.find(g => g.amount === grantAmount);
    return grant?.ticker || 'Unknown';
  };

  if (exercises.length === 0) {
    return (
      <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-lg mb-2">No exercises recorded yet</p>
        <p>Add your first exercise to track gains and taxes</p>
      </div>
    );
  }

  // Filter exercises for calculations (exclude simulations that aren't included)
  const includedExercises = exercises.filter(exercise => 
    !exercise.isSimulation || exercise.includeInCalculations
  );

  const totalGross = includedExercises.reduce((sum, exercise) => sum + exercise.beforeTax, 0);
  const totalTax = includedExercises.reduce((sum, exercise) => sum + (exercise.beforeTax - exercise.calculatedNet), 0);
  const totalNet = includedExercises.reduce((sum, exercise) => sum + (exercise.actualNet || exercise.calculatedNet), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg p-4`}>
          <h3 className="text-sm font-medium text-blue-600 mb-1">Total Gross</h3>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>{formatCurrency(totalGross)}</p>
        </div>
        <div className={`${isDarkMode ? 'bg-red-900/30' : 'bg-red-50'} rounded-lg p-4`}>
          <h3 className="text-sm font-medium text-red-600 mb-1">Total Tax</h3>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>{formatCurrency(totalTax)}</p>
        </div>
        <div className={`${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-lg p-4`}>
          <h3 className="text-sm font-medium text-green-600 mb-1">Total Net</h3>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Exercises Table */}
      <div className="overflow-x-auto">
        <table className={`min-w-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg`}>
          <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Include
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Stock
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Type
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Amount
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Exercise Price
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Gross Gain
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Net Amount
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Exercise Date
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {exercises.map((exercise) => {
              const ticker = getGrantTicker(exercise.grantAmount);
              const netAmount = exercise.actualNet || exercise.calculatedNet;
              const taxAmount = exercise.beforeTax - netAmount;
              const effectiveTaxRate = exercise.beforeTax > 0 ? (taxAmount / exercise.beforeTax) * 100 : 0;

              return (
                <tr key={exercise.id} className={`${
                  isDarkMode 
                    ? `hover:bg-gray-700 ${exercise.isSimulation ? 'bg-blue-900/20' : ''}` 
                    : `hover:bg-gray-50 ${exercise.isSimulation ? 'bg-blue-50' : ''}`
                }`}>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {exercise.isSimulation ? (
                      <input
                        type="checkbox"
                        checked={exercise.includeInCalculations || false}
                        onChange={() => toggleSimulationInclusion(exercise.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    ) : (
                      <span className="text-green-600 font-medium">✓</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{ticker}</div>
                      {exercise.isSimulation && (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                        }`}>
                          SIM
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      exercise.type === 'RSUs' 
                        ? (isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800')
                        : (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800')
                    }`}>
                      {exercise.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {exercise.amount.toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatCurrency(exercise.exercisePrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(exercise.beforeTax)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Grant: {formatCurrency(exercise.grantPrice)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(netAmount)}
                    </div>
                    <div className="text-xs text-red-500">
                      Tax: {formatCurrency(taxAmount)} ({effectiveTaxRate.toFixed(1)}%)
                    </div>
                    {exercise.actualNet && (
                      <div className="text-xs text-blue-500">Actual</div>
                    )}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatDate(exercise.exerciseDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onEditExercise(exercise)}
                      className={`mr-3 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exercise.id)}
                      className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'}`}
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
    </div>
  );
};