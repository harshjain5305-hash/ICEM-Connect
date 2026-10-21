import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'navy' | 'cyan' | 'tangerine' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const variants = {
    // Design.md §4.1: Indira Deep Navy
    default: 'bg-primary/10 text-primary border-primary/20',
    navy: 'bg-primary/10 text-primary border-primary/20',
    // Design.md §4.2: Electric Cyan-Teal (#00A2A5) - confirmed student badges, route tags
    cyan: 'bg-[#00A2A5]/10 text-[#00A2A5] border-[#00A2A5]/25 dark:bg-[#00A2A5]/20 dark:text-[#43CBD0]',
    // Design.md §4.2: Warm Tangerine (#E85C0D) - live ride indicators, urgency, pulses
    tangerine: 'bg-[#E85C0D]/10 text-[#E85C0D] border-[#E85C0D]/25 dark:bg-[#E85C0D]/20 dark:text-[#FFA07A]',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    // Design.md §4.4: Semantic Colors
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    destructive: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    outline: 'border-border text-foreground',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
