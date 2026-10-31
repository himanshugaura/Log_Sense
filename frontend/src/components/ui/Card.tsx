import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const base =
    'rounded-2xl border transition-all duration-150 relative overflow-hidden';

  const variantStyles = {
    default:
      'bg-white dark:bg-[#121212] border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]',
    subtle:
      'bg-neutral-50/70 dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800/80 text-neutral-900 dark:text-neutral-100',
    interactive:
      'bg-white dark:bg-[#121212] border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 text-neutral-900 dark:text-neutral-100 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`${base} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
