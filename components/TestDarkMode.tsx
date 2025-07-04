// components/TestDarkMode.tsx
'use client';

import { useAppStore } from '../store/useAppStore';

export default function TestDarkMode() {
  const { theme, toggleTheme } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-lg">
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Theme Test
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Current: {theme}
        </div>
        <button
          onClick={toggleTheme}
          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          Toggle Theme
        </button>
        <div className="text-xs space-y-1">
          <div className="text-gray-600 dark:text-gray-400">
            Background should be:
          </div>
          <div className="text-gray-800 dark:text-gray-200">
            {theme === 'dark' ? 'Dark (Gray-800)' : 'Light (White)'}
          </div>
        </div>
      </div>
    </div>
  );
}
