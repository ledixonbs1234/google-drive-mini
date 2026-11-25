// components/ResponsiveLayout.tsx
'use client';

import { useState, useEffect } from 'react';
import { FaBars, FaTimes, FaCloud } from 'react-icons/fa';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

export type BreakpointType = 'mobile' | 'tablet' | 'desktop';

export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<BreakpointType>('desktop');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isMounted,
  };
};

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  className = '',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile, isMounted } = useBreakpoint();

  if (!isMounted) {
    return <div className={`w-full min-h-screen bg-gray-50 dark:bg-zinc-900 ${className}`}>{children}</div>;
  }

  if (isMobile) {
    return (
      <div className={`w-full min-h-screen flex flex-col bg-gray-50 dark:bg-zinc-900 ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            {sidebar && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                aria-label="Mở menu điều hướng"
              >
                <FaBars className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
              <FaCloud className="text-orange-500 w-5 h-5" />
              <span>Drive Mini Chung</span>
            </div>
          </div>
        </div>

        {sidebar && sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-72 bg-white dark:bg-zinc-800 shadow-2xl z-50 overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
                <span className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaCloud className="text-orange-500" /> Drive Mini
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3" onClick={() => setSidebarOpen(false)}>
                {sidebar}
              </div>
            </div>
          </>
        )}

        <div className="flex-1 bg-gray-50 dark:bg-zinc-900">{children}</div>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen flex bg-gray-50 dark:bg-zinc-900 ${className}`}>
      {sidebar && (
        <aside className="w-64 flex-shrink-0 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 sticky top-0 h-screen overflow-y-auto">
          <div className="p-4">{sidebar}</div>
        </aside>
      )}

      <div className="flex-1 min-w-0 bg-gray-50 dark:bg-zinc-900">{children}</div>
    </div>
  );
};

export default ResponsiveLayout;
