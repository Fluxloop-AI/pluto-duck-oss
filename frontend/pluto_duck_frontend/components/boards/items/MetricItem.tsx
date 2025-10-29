'use client';

import { TrendingUpIcon, TrendingDownIcon, RefreshCwIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { BoardItem } from '../../../lib/boardsApi';
import { useBoardQuery } from '../../../hooks/useBoardQuery';
import { Loader } from '../../ai-elements';

interface MetricItemProps {
  item: BoardItem;
  projectId: string;
}

export function MetricItem({ item, projectId }: MetricItemProps) {
  const { data, loading, error, refresh } = useBoardQuery({
    itemId: item.id,
    projectId,
    autoFetch: true,
  });

  const payload = item.payload;
  const valueColumn = payload.value_column;
  const format = payload.format || 'number';
  const prefix = payload.prefix || '';
  const suffix = payload.suffix || '';
  const comparison = payload.comparison;

  const metricValue = useMemo(() => {
    if (!data?.data || data.data.length === 0) return null;
    
    // Assume query returns single row with aggregated value
    const firstRow = data.data[0];
    const rawValue = firstRow[valueColumn];
    
    if (rawValue == null) return null;
    
    const numValue = Number(rawValue);
    if (isNaN(numValue)) return String(rawValue);

    // Format based on type
    switch (format) {
      case 'currency':
        return `${prefix}${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
      case 'percent':
        return `${numValue.toFixed(2)}%`;
      case 'decimal':
        return `${prefix}${numValue.toFixed(payload.decimal_places || 2)}${suffix}`;
      default:
        return `${prefix}${numValue.toLocaleString()}${suffix}`;
    }
  }, [data, valueColumn, format, prefix, suffix, payload.decimal_places]);

  const trend = useMemo(() => {
    if (!comparison || !comparison.value || !metricValue) return null;
    
    const current = Number(metricValue.replace(/[^0-9.-]/g, ''));
    const previous = Number(comparison.value);
    const change = current - previous;
    const percentChange = (change / previous) * 100;
    
    return {
      direction: change >= 0 ? 'up' : 'down',
      value: change,
      percent: percentChange,
    };
  }, [metricValue, comparison]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          {payload.metric_name || 'Metric'}
        </h4>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCwIcon className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 flex items-center">
        <div>
          <div className="text-3xl font-bold">
            {metricValue || '-'}
          </div>
          
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.direction === 'up' ? (
                <TrendingUpIcon className="h-4 w-4" />
              ) : (
                <TrendingDownIcon className="h-4 w-4" />
              )}
              <span className="font-medium">
                {trend.percent.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                vs {comparison.type === 'previous_period' ? 'previous' : 'target'}
              </span>
            </div>
          )}
        </div>
      </div>

      {data && (
        <p className="text-xs text-muted-foreground mt-auto">
          Updated: {new Date(data.executed_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

