// components/ResponsiveLayout.tsx
'use client';

import { useState, useEffect } from 'react';
import { FaBars, FaTimes, FaChevronUp, FaChevronDown } from 'react-icons/fa';

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

  return { breakpoint, isMobile: breakpoint === 'mobile', isTablet: breakpoint === 'tablet', isDesktop: breakpoint === 'desktop', isMounted };
};

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  className = ''
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { breakpoint, isMobile, isMounted } = useBreakpoint();

  // Don't render until mounted to prevent hydration issues
  if (!isMounted) {
    return <div className={`w-full h-screen ${className}`}>{children}</div>;
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (isMobile) {
    return (
      <div className={`w-full h-screen flex flex-col ${className}`}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 relative z-50">
          <div className="flex items-center space-x-3">
            {sidebar && (
              <button
                onClick={toggleSidebar}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
              >
                <FaBars className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
              Google Drive Mini
            </h1>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebar && sidebarOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            
            {/* Sidebar */}
            <div className="fixed top-0 left-0 h-full w-80 bg-white dark:bg-zinc-800 shadow-lg z-50 transform transition-transform duration-300">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Menu</h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                {sidebar}
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  // Desktop/Tablet layout
  return (
    <div className={`w-full h-screen flex ${className}`}>
      {/* Sidebar */}
      {sidebar && (
        <div className="w-64 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 overflow-y-auto">
          <div className="p-4">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default ResponsiveLayout;
