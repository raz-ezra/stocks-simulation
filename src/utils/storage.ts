// Function to get storage key with mock prefix if needed
export const getStorageKey = (baseKey: string): string => {
  // We need to check localStorage directly since we can't use stores in utilities
  // This will check the settings to determine if we should use mock storage
  const settingsStorage = localStorage.getItem('settings-storage');
  let useMockData = false;
  
  if (settingsStorage) {
    try {
      const parsed = JSON.parse(settingsStorage);
      useMockData = parsed.state?.useMockData || false;
    } catch (error) {
      console.warn('Error parsing settings storage:', error);
    }
  }
  
  return useMockData ? `mock-${baseKey}` : baseKey;
};

// Function to clear all mock data
export const clearMockData = () => {
  const mockKeys = [
    'mock-grants-storage',
    'mock-exercises-storage',
    'mock-stock-prices-storage',
    'mock-currency-storage',
    'mock-tax-settings-storage'
  ];
  
  mockKeys.forEach(key => {
    localStorage.removeItem(key);
  });
};

// Function to initialize mock data if it doesn't exist
export const initializeMockData = () => {
  const mockGrantsKey = 'mock-grants-storage';
  const mockExercisesKey = 'mock-exercises-storage';
  
  // Check if mock grants data already exists
  if (localStorage.getItem(mockGrantsKey)) {
    return; // Mock data already exists
  }
  
  console.log('Initializing mock data...');
  
  // Create mock grants (3 LMND grants)
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  
  const mockGrants = [
    {
      id: 'mock-grant-1',
      amount: 1000,
      vestingFrom: oneYearAgo,
      grantDate: oneYearAgo,
      vestingYears: 4,
      price: 15.50,
      type: 'RSUs',
      ticker: 'LMND',
      isSection102: false
    },
    {
      id: 'mock-grant-2',
      amount: 500,
      vestingFrom: sixMonthsAgo,
      grantDate: sixMonthsAgo,
      vestingYears: 4,
      price: 12.25,
      type: 'Options',
      ticker: 'LMND',
      isSection102: true,
      section102Track: 'capital-gains'
    },
    {
      id: 'mock-grant-3',
      amount: 750,
      vestingFrom: threeMonthsAgo,
      grantDate: threeMonthsAgo,
      vestingYears: 4,
      price: 18.75,
      type: 'RSUs',
      ticker: 'LMND',
      isSection102: true,
      section102Track: 'capital-gains'
    }
  ];
  
  // Create mock exercises (2 simulated exercises)
  const mockExercises = [
    {
      id: 'mock-exercise-1',
      amount: 100,
      grantAmount: 1000,
      exerciseDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
      type: 'RSUs',
      grantPrice: 15.50,
      exercisePrice: 22.00,
      usdIlsRate: 3.65,
      beforeTax: 2200,
      calculatedNet: 1166, // ~47% tax on RSUs
      actualNet: null,
      isSimulation: true,
      includeInCalculations: true
    },
    {
      id: 'mock-exercise-2', 
      amount: 50,
      grantAmount: 500,
      exerciseDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15),
      type: 'Options',
      grantPrice: 12.25,
      exercisePrice: 20.00,
      usdIlsRate: 3.65,
      beforeTax: 1000,
      calculatedNet: 806.25, // 25% capital gains tax on options gain
      actualNet: null,
      isSimulation: true,
      includeInCalculations: true
    }
  ];
  
  // Store mock grants
  const grantsData = {
    state: { grants: mockGrants },
    version: 0
  };
  localStorage.setItem(mockGrantsKey, JSON.stringify(grantsData));
  
  // Store mock exercises
  const exercisesData = {
    state: { exercises: mockExercises },
    version: 0
  };
  localStorage.setItem(mockExercisesKey, JSON.stringify(exercisesData));
  
  console.log('Mock data initialized successfully');
};

export const clearCorruptedStorage = () => {
  try {
    // Clear potentially corrupted Zustand stores
    localStorage.removeItem('grants-storage');
    localStorage.removeItem('exercises-storage');
    console.log('Cleared potentially corrupted localStorage data');
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
};

export const validateStorageData = () => {
  try {
    // Check grants storage
    const grantsData = localStorage.getItem('grants-storage');
    if (grantsData) {
      const parsed = JSON.parse(grantsData);
      if (parsed.state?.grants) {
        parsed.state.grants.forEach((grant: any) => {
          if (grant.vestingFrom && isNaN(Date.parse(grant.vestingFrom))) {
            throw new Error('Invalid vestingFrom date');
          }
          if (grant.grantDate && isNaN(Date.parse(grant.grantDate))) {
            throw new Error('Invalid grantDate');
          }
        });
      }
    }

    // Check exercises storage
    const exercisesData = localStorage.getItem('exercises-storage');
    if (exercisesData) {
      const parsed = JSON.parse(exercisesData);
      if (parsed.state?.exercises) {
        parsed.state.exercises.forEach((exercise: any) => {
          if (exercise.exerciseDate && isNaN(Date.parse(exercise.exerciseDate))) {
            throw new Error('Invalid exerciseDate');
          }
        });
      }
    }
  } catch (error) {
    console.warn('Storage validation failed, clearing corrupted data:', error);
    clearCorruptedStorage();
    // Reload the page to start with fresh state
    window.location.reload();
  }
};