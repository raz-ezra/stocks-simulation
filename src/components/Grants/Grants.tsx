import React, { useState } from 'react';
import { GrantForm } from './GrantForm';
import { GrantsList } from './GrantsList';
import { Grant } from '../../types';
import { useThemeStore } from '../../stores/useThemeStore';

export const Grants: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const { isDarkMode } = useThemeStore();

  const handleAddGrant = () => {
    setEditingGrant(null);
    setShowForm(true);
  };

  const handleEditGrant = (grant: Grant) => {
    setEditingGrant(grant);
    setShowForm(true);
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingGrant(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingGrant(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Grants Management</h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Add and manage your stock grants (RSUs and Options)
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleAddGrant}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Grant</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>
            {editingGrant ? 'Edit Grant' : 'Add New Grant'}
          </h3>
          <GrantForm
            grant={editingGrant || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Your Grants</h3>
        <GrantsList onEditGrant={handleEditGrant} />
      </div>
    </div>
  );
};