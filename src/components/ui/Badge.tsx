import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-primary/10 text-primary border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
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
