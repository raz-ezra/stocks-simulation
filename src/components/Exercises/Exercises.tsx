import React, { useState } from 'react';
import { ExerciseForm } from './ExerciseForm';
import { ExercisesList } from './ExercisesList';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Exercise } from '../../types';

export const Exercises: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const grants = useGrantsStore((state) => state.grants);
  const { isDarkMode } = useThemeStore();

  const handleAddExercise = () => {
    setEditingExercise(null);
    setShowForm(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setShowForm(true);
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingExercise(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingExercise(null);
  };

  const hasGrants = grants.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Exercises Tracking</h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Record your stock option exercises and RSU sales with tax calculations
          </p>
        </div>
        {!showForm && hasGrants && (
          <button
            onClick={handleAddExercise}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Exercise</span>
          </button>
        )}
      </div>

      {!hasGrants && (
        <div className={`${isDarkMode ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'} border rounded-lg p-6 text-center`}>
          <div className={`${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>
            <h3 className="text-lg font-medium mb-2">No Grants Available</h3>
            <p className="text-sm">
              You need to add grants first before recording exercises. 
              Go to the Grants section to add your stock grants.
            </p>
          </div>
        </div>
      )}

      {showForm && hasGrants && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>
            {editingExercise ? 'Edit Exercise' : 'Record New Exercise'}
          </h3>
          <ExerciseForm
            exercise={editingExercise || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {hasGrants && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Exercise History</h3>
          <ExercisesList onEditExercise={handleEditExercise} />
        </div>
      )}
    </div>
  );
};