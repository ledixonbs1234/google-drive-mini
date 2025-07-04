// hooks/useTouchGestures.ts
'use client';

import { useRef, useCallback, useState } from 'react';

interface TouchGestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number; // Minimum distance for swipe
  longPressThreshold?: number; // Time in ms for long press
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export const useTouchGestures = (config: TouchGestureConfig) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    threshold = 50,
    longPressThreshold = 500
  } = config;

  const startTouch = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialDistance = useRef<number>(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const getTouchPoint = (touch: React.Touch): TouchPoint => ({
    x: touch.clientX,
    y: touch.clientY,
    timestamp: Date.now()
  });

  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    if (e.touches.length === 1) {
      // Single touch
      startTouch.current = getTouchPoint(touch);
      setIsLongPressing(false);

      // Start long press timer
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          setIsLongPressing(true);
          onLongPress();
        }, longPressThreshold);
      }
    } else if (e.touches.length === 2 && onPinch) {
      // Two finger touch for pinch
      clearLongPressTimer();
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
    }
  }, [onLongPress, longPressThreshold, onPinch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && onPinch && initialDistance.current > 0) {
      // Handle pinch gesture
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance.current;
      onPinch(scale);
    } else {
      // Cancel long press if finger moves
      clearLongPressTimer();
    }
  }, [onPinch]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPressTimer();
    
    if (isLongPressing) {
      setIsLongPressing(false);
      return;
    }

    if (!startTouch.current || e.touches.length > 0) {
      return;
    }

    const endTouch = e.changedTouches[0];
    const endPoint = getTouchPoint(endTouch);
    
    const deltaX = endPoint.x - startTouch.current.x;
    const deltaY = endPoint.y - startTouch.current.y;
    const deltaTime = endPoint.timestamp - startTouch.current.timestamp;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for swipe gestures
    if (distance >= threshold) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    } else if (distance < 10 && deltaTime < 300) {
      // Tap gesture
      const now = Date.now();
      const timeSinceLastTap = now - lastTap.current;
      
      if (timeSinceLastTap < 300 && onDoubleTap) {
        // Double tap
        onDoubleTap();
        lastTap.current = 0;
      } else {
        // Single tap
        if (onTap) {
          onTap();
        }
        lastTap.current = now;
      }
    }

    startTouch.current = null;
    initialDistance.current = 0;
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap, isLongPressing]);

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    startTouch.current = null;
    initialDistance.current = 0;
    setIsLongPressing(false);
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    isLongPressing
  };
};

// Utility hook for swipe-to-delete functionality
export const useSwipeToDelete = (
  onDelete: () => void,
  threshold: number = 100
) => {
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const gestures = useTouchGestures({
    onSwipeLeft: () => {
      if (swipeDistance > threshold) {
        setIsDeleting(true);
        setTimeout(() => {
          onDelete();
          setIsDeleting(false);
          setSwipeDistance(0);
        }, 200);
      }
    },
    threshold: threshold / 2
  });

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      // Calculate swipe distance for visual feedback
      // This is a simplified version - you might want to track from touch start
      setSwipeDistance(Math.max(0, -touch.clientX + window.innerWidth));
    }
    gestures.onTouchMove(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setSwipeDistance(0);
    gestures.onTouchEnd(e);
  };

  return {
    ...gestures,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    swipeDistance,
    isDeleting
  };
};

// Hook for pull-to-refresh functionality
export const usePullToRefresh = (
  onRefresh: () => Promise<void> | void,
  threshold: number = 80
) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);

  const gestures = useTouchGestures({
    onSwipeDown: async () => {
      if (pullDistance > threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      }
    },
    threshold: threshold / 2
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull to refresh at the top of the page
    setCanPull(window.scrollY === 0);
    gestures.onTouchStart(e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (canPull && e.touches.length === 1) {
      const touch = e.touches[0];
      // Calculate pull distance for visual feedback
      setPullDistance(Math.max(0, touch.clientY - 50));
    }
    gestures.onTouchMove(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isRefreshing) {
      setPullDistance(0);
    }
    setCanPull(false);
    gestures.onTouchEnd(e);
  };

  return {
    ...gestures,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    pullDistance,
    isRefreshing,
    shouldShowRefreshIndicator: pullDistance > threshold || isRefreshing
  };
};
