// components/PullToRefresh.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaSpinner, FaArrowDown, FaCheck } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPullDistance?: number;
  children: React.ReactNode;
  className?: string;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'complete';

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  children,
  className = ''
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isScrolledToTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    return container.scrollTop === 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isScrolledToTop()) return;
    setStartY(e.touches[0].clientY);
  }, [isScrolledToTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isScrolledToTop() || refreshState === 'refreshing') return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      e.preventDefault();
      setIsPulling(true);
      
      const distance = Math.min(deltaY * 0.5, maxPullDistance);
      setPullDistance(distance);
      
      if (distance >= threshold && refreshState !== 'ready') {
        setRefreshState('ready');
      } else if (distance < threshold && refreshState === 'ready') {
        setRefreshState('pulling');
      } else if (distance > 0 && refreshState === 'idle') {
        setRefreshState('pulling');
      }
    }
  }, [startY, threshold, maxPullDistance, refreshState, isScrolledToTop]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (refreshState === 'ready') {
      setRefreshState('refreshing');
      try {
        await onRefresh();
        setRefreshState('complete');
        setTimeout(() => {
          setRefreshState('idle');
          setPullDistance(0);
        }, 1000);
      } catch (error) {
        console.error('Refresh failed:', error);
        setRefreshState('idle');
        setPullDistance(0);
      }
    } else {
      setRefreshState('idle');
      setPullDistance(0);
    }
  }, [isPulling, refreshState, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive listeners for better performance
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const getRefreshIcon = () => {
    switch (refreshState) {
      case 'pulling':
        return <FaArrowDown className="w-4 h-4 text-gray-500" />;
      case 'ready':
        return <FaArrowDown className="w-4 h-4 text-blue-500 transform rotate-180" />;
      case 'refreshing':
        return <FaSpinner className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'complete':
        return <FaCheck className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getRefreshText = () => {
    switch (refreshState) {
      case 'pulling':
        return 'Kéo để làm mới';
      case 'ready':
        return 'Thả để làm mới';
      case 'refreshing':
        return 'Đang làm mới...';
      case 'complete':
        return 'Hoàn thành!';
      default:
        return '';
    }
  };

  return (
    <div
      ref={containerRef}
      className={twMerge(
        'relative h-full overflow-auto',
        className
      )}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className={twMerge(
          'absolute top-0 left-0 right-0 flex items-center justify-center',
          'bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700',
          'transform transition-all duration-300 ease-out',
          refreshState === 'idle' ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        )}
        style={{
          height: Math.max(pullDistance, 0),
          minHeight: refreshState !== 'idle' ? '60px' : '0px'
        }}
      >
        <div className="flex items-center space-x-2">
          {getRefreshIcon()}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {getRefreshText()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-full">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
