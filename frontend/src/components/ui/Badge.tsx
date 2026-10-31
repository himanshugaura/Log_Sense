import React from 'react';

export type StatusType =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'healthy'
  | 'degraded'
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'FATAL'
  | 'ERROR'
  | 'WARN'
  | 'INFO'
  | 'DEBUG';

interface StatusIndicatorProps {
  status?: StatusType | string;
  variant?: StatusType | string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  variant,
  label: customLabel,
  className = '',
  showIcon = true,
}) => {
  const effectiveStatus = status || variant || 'INFO';
  const norm = String(effectiveStatus).toUpperCase();

  const getStyle = () => {
    switch (norm) {
      case 'CRITICAL':
      case 'FATAL':
        return {
          text: 'text-red-700 dark:text-red-400 font-semibold',
          symbol: '●',
          label: customLabel || 'Critical',
        };
      case 'HIGH':
      case 'ERROR':
      case 'DEGRADED':
        return {
          text: 'text-amber-700 dark:text-amber-400 font-semibold',
          symbol: '▲',
          label: customLabel || (norm === 'DEGRADED' ? 'Degraded' : 'High'),
        };
      case 'MEDIUM':
      case 'WARN':
      case 'INVESTIGATING':
        return {
          text: 'text-yellow-700 dark:text-yellow-500 font-medium',
          symbol: '■',
          label: customLabel || (norm === 'INVESTIGATING' ? 'Investigating' : 'Medium'),
        };
      case 'LOW':
      case 'HEALTHY':
      case 'RESOLVED':
        return {
          text: 'text-emerald-700 dark:text-emerald-400 font-medium',
          symbol: '✓',
          label: customLabel || (norm === 'HEALTHY' ? 'Healthy' : norm === 'RESOLVED' ? 'Resolved' : 'Low'),
        };
      case 'OPEN':
        return {
          text: 'text-red-700 dark:text-red-400 font-semibold',
          symbol: '●',
          label: customLabel || 'Open',
        };
      case 'INFO':
      default:
        return {
          text: 'text-neutral-600 dark:text-neutral-400 font-medium',
          symbol: '○',
          label: customLabel || effectiveStatus,
        };
    }
  };

  const style = getStyle();

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${style.text} ${className}`}>
      {showIcon && <span aria-hidden="true" className="text-[10px] leading-none">{style.symbol}</span>}
      <span>{style.label}</span>
    </span>
  );
};
