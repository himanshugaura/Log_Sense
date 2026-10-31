import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { StatusIndicator } from '../../components/ui/Badge';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const service = data as any;
  const anomaliesCount = service.anomaliesCount || service.errorCount || 0;
  const isCritical = anomaliesCount > 0 || service.status === 'critical';
  const isDegraded = service.status === 'degraded';
  const category = service.category || 'service';
  const status = isCritical ? 'critical' : isDegraded ? 'degraded' : 'healthy';

  return (
    <div
      className={`px-4 py-3 rounded-xl border bg-white dark:bg-[#121212] transition-all min-w-[190px] shadow-xs ${
        selected
          ? 'ring-2 ring-neutral-900 dark:ring-neutral-100 border-neutral-900 dark:border-neutral-100'
          : isCritical
          ? 'border-red-400 dark:border-red-800 bg-red-50/20 dark:bg-red-950/20'
          : isDegraded
          ? 'border-amber-400 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-neutral-400" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
          {category}
        </span>
        <StatusIndicator status={status} />
      </div>

      <div className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
        {service.name}
      </div>

      <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-[11px] font-mono text-neutral-500">
        <span>{anomaliesCount > 0 ? `${anomaliesCount} alerts` : 'nominal'}</span>
        <span>{service.logEntriesCount || 0} events</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-neutral-400" />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
