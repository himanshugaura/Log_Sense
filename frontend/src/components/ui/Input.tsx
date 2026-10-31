import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-neutral-400 pointer-events-none shrink-0">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900/90 ${
              icon ? 'pl-10' : 'px-3.5'
            } py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:outline-none transition-colors ${
              error ? 'border-red-500 focus:border-red-500' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
