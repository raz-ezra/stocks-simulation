import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Exercise } from '../types';

interface ExercisesStore {
  exercises: Exercise[];
  addExercise: (exercise: Omit<Exercise, 'id'>) => void;
  updateExercise: (id: string, exercise: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  getExercisesByGrant: (grantAmount: number) => Exercise[];
  toggleSimulationInclusion: (id: string) => void;
}

export const useExercisesStore = create<ExercisesStore>()(
  persist(
    (set, get) => ({
      exercises: [],
      
      addExercise: (exerciseData) =>
        set((state) => ({
          exercises: [
            ...state.exercises,
            { ...exerciseData, id: crypto.randomUUID() },
          ],
        })),
      
      updateExercise: (id, updates) =>
        set((state) => ({
          exercises: state.exercises.map((exercise) =>
            exercise.id === id ? { ...exercise, ...updates } : exercise
          ),
        })),
      
      deleteExercise: (id) =>
        set((state) => ({
          exercises: state.exercises.filter((exercise) => exercise.id !== id),
        })),
      
      getExercisesByGrant: (grantAmount) =>
        get().exercises.filter((exercise) => exercise.grantAmount === grantAmount),
      
      toggleSimulationInclusion: (id) =>
        set((state) => ({
          exercises: state.exercises.map((exercise) =>
            exercise.id === id 
              ? { ...exercise, includeInCalculations: !exercise.includeInCalculations }
              : exercise
          ),
        })),
    }),
    {
      name: 'exercises-storage',
      serialize: (state) => {
        return JSON.stringify(state);
      },
      deserialize: (str) => {
        try {
          const parsed = JSON.parse(str);
          // Convert date strings back to Date objects
          if (parsed.state && parsed.state.exercises) {
            parsed.state.exercises = parsed.state.exercises.map((exercise: any) => {
              try {
                return {
                  ...exercise,
                  exerciseDate: new Date(exercise.exerciseDate),
                };
              } catch (error) {
                console.warn('Error parsing exercise dates:', error);
                // Return exercise with current date as fallback
                return {
                  ...exercise,
                  exerciseDate: new Date(),
                };
              }
            });
          }
          return parsed;
        } catch (error) {
          console.warn('Error deserializing exercises:', error);
          // Return empty state if deserialization fails
          return { state: { exercises: [] }, version: 0 };
        }
      },
    }
  )
);