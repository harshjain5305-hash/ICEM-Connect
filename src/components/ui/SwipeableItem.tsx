import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void | Promise<void>;
  deleteLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onDelete,
  deleteLabel = 'Delete',
  className = '',
  disabled = false,
}) => {
  const [offsetX, setOffsetX] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isDeleting) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || disabled || isDeleting) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    // Only allow sliding to the left (negative offset)
    if (diff < 0) {
      setOffsetX(Math.max(-90, diff));
    } else {
      setOffsetX(0);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    setOffsetX(-150);
    try {
      await onDelete();
    } catch (e) {
      console.error('Delete error:', e);
      setIsDeleting(false);
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping || disabled) return;
    setIsSwiping(false);
    // If swiped far enough left (past -50px), snap open or delete
    if (offsetX <= -75) {
      executeDelete();
    } else if (offsetX <= -40) {
      setOffsetX(-70); // Snap open to reveal delete button
    } else {
      setOffsetX(0); // Snap closed
    }
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 group ${
        isDeleting ? 'max-h-0 opacity-0 -translate-x-full py-0 my-0 border-0 pointer-events-none' : ''
      } ${className}`}
    >
      {/* BACKGROUND DELETE ACTION BUTTON (REVEALED ON SLIDE) */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center text-white z-0 rounded-r-xl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            executeDelete();
          }}
          className="w-full h-full flex flex-col items-center justify-center gap-1 text-xs font-semibold focus:outline-none hover:bg-red-700 transition-colors"
          aria-label={deleteLabel}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[10px]">{deleteLabel}</span>
        </button>
      </div>

      {/* FOREGROUND SLIDABLE ITEM */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative z-10 bg-card w-full"
      >
        {children}

        {/* DESKTOP HOVER / ACCESSIBILITY QUICK DELETE BUTTON */}
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              executeDelete();
            }}
            title={deleteLabel}
            aria-label={deleteLabel}
            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 z-20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
