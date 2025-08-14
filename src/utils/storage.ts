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