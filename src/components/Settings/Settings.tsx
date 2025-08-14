import React, { useState, useRef } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useStockPricesStore } from '../../stores/useStockPricesStore';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onForceRefresh: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onForceRefresh }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings store
  const { autoFetchEnabled, setAutoFetchEnabled, polygonApiKey, setPolygonApiKey } = useSettingsStore();
  
  // Theme store
  const { isDarkMode, toggleTheme, setTheme } = useThemeStore();
  
  // Other stores for export/import
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const currencyState = useCurrencyStore();

  const [apiKeyInput, setApiKeyInput] = useState(polygonApiKey || '');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);

  const maskApiKey = (key: string): string => {
    if (!key || key.length <= 4) return key;
    const lastFour = key.slice(-4);
    const maskedPart = '•'.repeat(Math.max(8, key.length - 4));
    return `${maskedPart}${lastFour}`;
  };

  const handleSaveApiKey = () => {
    setPolygonApiKey(apiKeyInput);
    setIsEditingApiKey(false);
  };

  const handleEditApiKey = () => {
    setIsEditingApiKey(true);
    setApiKeyInput(polygonApiKey || '');
  };

  const handleCancelEdit = () => {
    setIsEditingApiKey(false);
    setApiKeyInput(polygonApiKey || '');
  };

  const exportData = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      grants,
      exercises,
      stockPrices,
      currency: {
        usdIlsRate: currencyState.usdIlsRate,
        lastUpdated: currencyState.lastUpdated,
      },
      settings: {
        autoFetchEnabled,
        polygonApiKey: polygonApiKey || '',
        isDarkMode,
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-simulation-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        // Validate the data structure
        if (!importedData.version || !importedData.grants) {
          alert('Invalid file format. Please select a valid exported data file.');
          return;
        }

        // Import data to stores
        if (importedData.grants) {
          useGrantsStore.setState({ grants: importedData.grants });
        }
        
        if (importedData.exercises) {
          useExercisesStore.setState({ exercises: importedData.exercises });
        }
        
        if (importedData.stockPrices) {
          useStockPricesStore.setState({ stockPrices: importedData.stockPrices });
        }
        
        if (importedData.currency) {
          useCurrencyStore.setState({
            usdIlsRate: importedData.currency.usdIlsRate || 3.7,
            lastUpdated: importedData.currency.lastUpdated,
          });
        }
        
        if (importedData.settings) {
          setAutoFetchEnabled(importedData.settings.autoFetchEnabled ?? true);
          setPolygonApiKey(importedData.settings.polygonApiKey || '');
          setApiKeyInput(importedData.settings.polygonApiKey || '');
          
          // Restore dark mode preference
          if (typeof importedData.settings.isDarkMode === 'boolean') {
            setTheme(importedData.settings.isDarkMode);
          }
        }

        alert('Data imported successfully!');
        onClose();
        
        // Force a page refresh to ensure all data is properly loaded
        window.location.reload();
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const resetAllData = () => {
    const confirmMessage = "⚠️ DANGER: This will permanently delete ALL your data including:\n\n" +
      "• All grants\n" +
      "• All exercises\n" +
      "• All stock prices\n" +
      "• All settings\n" +
      "• Currency data\n\n" +
      "This action CANNOT be undone!\n\n" +
      "Type 'DELETE ALL DATA' to confirm:";
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === 'DELETE ALL DATA') {
      // Clear all stores
      useGrantsStore.setState({ grants: [] });
      useExercisesStore.setState({ exercises: [] });
      useStockPricesStore.setState({ stockPrices: {} });
      useCurrencyStore.setState({ 
        usdIlsRate: 3.7, 
        lastUpdated: null, 
        error: null, 
        isLoading: false 
      });
      useSettingsStore.setState({ 
        autoFetchEnabled: true, 
        polygonApiKey: null 
      });
      
      // Reset theme to default (dark mode)
      setTheme(true);

      // Clear localStorage manually as backup
      Object.keys(localStorage).forEach(key => {
        if (key.includes('grants-storage') || 
            key.includes('exercises-storage') || 
            key.includes('stock-prices-storage') || 
            key.includes('currency-storage') || 
            key.includes('settings-storage') ||
            key.includes('theme-storage')) {
          localStorage.removeItem(key);
        }
      });

      alert('✅ All data has been permanently deleted.');
      onClose();
      
      // Force page reload to ensure clean state
      window.location.reload();
    } else if (userInput !== null) {
      alert('Reset cancelled. You must type exactly "DELETE ALL DATA" to confirm.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-xl z-50 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Settings</h2>
          <button
            onClick={onClose}
            className={`text-xl font-bold ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme Controls */}
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Appearance</h3>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Dark mode</span>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Switch between light and dark themes</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={isDarkMode}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          {/* Auto-fetch Controls */}
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Stock Price Fetching</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Auto-fetch (1min intervals)</span>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Automatically fetch stock prices every minute</p>
                </div>
                <button
                  onClick={() => setAutoFetchEnabled(!autoFetchEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    autoFetchEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={autoFetchEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoFetchEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <button
                onClick={() => {
                  onForceRefresh();
                  onClose();
                }}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                🔄 Force Refresh Prices Now
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Polygon.io API Key</h3>
            <div className="space-y-2">
              {!isEditingApiKey && polygonApiKey ? (
                /* Display masked API key */
                <div className="space-y-2">
                  <div className={`w-full px-3 py-2 border rounded-md text-sm flex items-center justify-between ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}>
                    <span className="font-mono tracking-wider">{maskApiKey(polygonApiKey)}</span>
                    <button
                      onClick={handleEditApiKey}
                      className={`ml-2 px-2 py-1 text-xs rounded ${
                        isDarkMode 
                          ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } transition-colors`}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit mode or no API key */
                <>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Polygon.io API key"
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    autoFocus={isEditingApiKey}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveApiKey}
                      className="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                    >
                      Save API Key
                    </button>
                    {isEditingApiKey && (
                      <button
                        onClick={handleCancelEdit}
                        className={`px-3 py-2 text-sm rounded-md transition-colors ${
                          isDarkMode 
                            ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Get your free API key at{' '}
                <a href="https://polygon.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  polygon.io/dashboard
                </a>
              </p>
            </div>
          </div>

          {/* Data Management */}
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Data Management</h3>
            <div className="space-y-2">
              <button
                onClick={exportData}
                className="w-full px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                📥 Export All Data
              </button>
              
              <button
                onClick={triggerImport}
                className="w-full px-3 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
              >
                📤 Import Data
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
              
              {/* Danger Zone */}
              <div className="mt-4 pt-4 border-t border-red-200">
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h4 className="text-sm font-medium text-red-800">Danger Zone</h4>
                  </div>
                </div>
                
                <button
                  onClick={resetAllData}
                  className="w-full px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors border-2 border-red-700"
                >
                  🗑️ Reset All Data (Permanent)
                </button>
              </div>
              
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Export saves all grants, exercises, stock prices, and settings to a JSON file.
                Import overwrites all current data. Reset permanently deletes everything.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};