import React, { useState, useRef, useEffect } from 'react';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

export interface ThemeToggleProps {
  className?: string;
  showDropdown?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showDropdown = false,
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectMode = (mode: ThemeMode) => {
    setTheme(mode);
    setIsOpen(false);
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={showDropdown ? () => setIsOpen((prev) => !prev) : toggleTheme}
        aria-label={
          isDark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
        }
        title={
          isDark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-xs transition-all hover:bg-muted hover:border-primary/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-[36px] min-w-[36px]"
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-[#00A2A5] transition-transform duration-300 rotate-0 hover:-rotate-12" />
        ) : (
          <Sun className="h-4 w-4 text-[#E85C0D] transition-transform duration-300 rotate-0 hover:rotate-45" />
        )}
        <span className="sr-only">Toggle theme</span>
      </button>

      {/* DROPDOWN MENU IF ENABLED */}
      {showDropdown && isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => handleSelectMode('light')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              theme === 'light'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-[#E85C0D]" />
              <span>Light</span>
            </span>
            {theme === 'light' && <Check className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('dark')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              theme === 'dark'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-[#00A2A5]" />
              <span>Dark</span>
            </span>
            {theme === 'dark' && <Check className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('system')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              theme === 'system'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <span>System</span>
            </span>
            {theme === 'system' && <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
