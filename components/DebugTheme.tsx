// components/DebugTheme.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function DebugTheme() {
  const theme = useAppStore((state) => state.theme);
  const [domClasses, setDomClasses] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const updateDOMClasses = () => {
      setDomClasses(document.documentElement.classList.toString());
    };
    
    updateDOMClasses();
    
    // Theo dõi thay đổi DOM
    const observer = new MutationObserver(updateDOMClasses);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 text-xs font-mono z-50">
      <div className="space-y-1">
        <div>State: <span className="font-bold">{theme}</span></div>
        <div>DOM: <span className="font-bold">{domClasses || 'no classes'}</span></div>
        <div>Has dark: <span className="font-bold">{domClasses.includes('dark') ? 'YES' : 'NO'}</span></div>
      </div>
    </div>
  );
}
