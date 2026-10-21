import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'destructive';
  title?: string;
}

export function Alert({
  className,
  variant = 'info',
  title,
  children,
  ...props
}: AlertProps) {
  const icons = {
    info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />,
    destructive: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />,
  };

  const styles = {
    info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900',
    warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900',
    destructive: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900',
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm shadow-xs',
        styles[variant],
        className
      )}
      {...props}
    >
      {icons[variant]}
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold leading-tight">{title}</h5>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
}
