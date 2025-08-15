import React, { useState } from 'react';
import { GrowthSimulation } from './GrowthSimulation';
import { ExerciseSimulation } from './ExerciseSimulation';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useThemeStore } from '../../stores/useThemeStore';

type SimulationType = 'growth' | 'exercise';

export const Simulations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SimulationType>('growth');
  const grants = useGrantsStore((state) => state.grants);
  const { isDarkMode } = useThemeStore();

  const tabs = [
    { id: 'growth' as SimulationType, label: 'Growth Scenarios', description: 'Future value projections with different growth rates' },
    { id: 'exercise' as SimulationType, label: 'Exercise Planning', description: 'Calculate gains from exercising specific grants' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Portfolio Simulations</h2>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Model different scenarios to plan your financial future and optimize exercise timing
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
        <div className="space-y-6">
          {/* Tabs */}
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 text-left transition-colors ${
                    activeTab === tab.id
                      ? (isDarkMode 
                          ? 'bg-blue-900/50 border-b-2 border-blue-400 text-blue-200' 
                          : 'bg-blue-50 border-b-2 border-blue-500 text-blue-700')
                      : (isDarkMode 
                          ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                  }`}
                >
                  <div className="font-medium">{tab.label}</div>
                  <div className={`text-sm mt-1 ${
                    activeTab === tab.id 
                      ? (isDarkMode ? 'text-blue-300' : 'text-blue-600')
                      : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                  }`}>
                    {tab.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'growth' && <GrowthSimulation />}
            {activeTab === 'exercise' && <ExerciseSimulation />}
          </div>
        </div>
      )}
    </div>
  );
};