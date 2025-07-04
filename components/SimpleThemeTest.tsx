// components/SimpleThemeTest.tsx
'use client';

import { useAppStore } from '../store/useAppStore';
import { useEffect, useState } from 'react';

export default function SimpleThemeTest() {
  const { theme, toggleTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2">
      {/* Test 1: Inline styles (always works) */}
      <div 
        className="p-4 rounded-lg shadow-lg border transition-all duration-300"
        style={{
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
          borderColor: theme === 'dark' ? '#374151' : '#d1d5db',
          color: theme === 'dark' ? '#f9fafb' : '#111827'
        }}
      >
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Test 1: Inline Styles
          </div>
          <div className="text-xs">
            Theme: {theme}
          </div>
          <div className="text-xs">
            HTML has dark: {typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'YES' : 'NO'}
          </div>
        </div>
      </div>

      {/* Test 2: CSS custom classes */}
      <div className="debug-dark-test p-4 rounded-lg shadow-lg border transition-all duration-300">
        <div className="text-sm font-medium">
          Test 2: CSS Custom Classes
        </div>
        <div className="text-xs">
          Should change color with .dark .debug-dark-test rule
        </div>
      </div>

      {/* Test 3: Tailwind dark classes */}
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 transition-all duration-300">
        <div className="text-sm font-medium">
          Test 3: Tailwind Dark Classes
        </div>
        <div className="text-xs">
          bg-white dark:bg-gray-800
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleTheme}
        className="w-full px-3 py-2 text-xs rounded border bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white transition-colors"
      >
        Toggle Theme
      </button>
    </div>
  );
}
