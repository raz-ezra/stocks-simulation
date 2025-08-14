import React, { forwardRef } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';

interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className = '', error = false, ...props }, ref) => {
    const { isDarkMode } = useThemeStore();

    return (
      <div className="relative">
        <input
          ref={ref}
          type="date"
          className={`
            w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
            ${isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
            }
            ${error ? 'border-red-500' : ''}
            ${className}
          `}
          style={{
            // Hide the default calendar icon
            colorScheme: isDarkMode ? 'dark' : 'light',
          }}
          {...props}
        />
        
        {/* Custom calendar icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg 
            className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
        
        <style>{`
          input[type="date"]::-webkit-calendar-picker-indicator {
            background: transparent;
            bottom: 0;
            color: transparent;
            cursor: pointer;
            height: auto;
            left: 0;
            position: absolute;
            right: 0;
            top: 0;
            width: auto;
          }
        `}</style>
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';