'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { BoardItem } from '../../../lib/boardsApi';
import { useBoardQuery } from '../../../hooks/useBoardQuery';
import { Loader } from '../../ai-elements';

interface ChartItemProps {
  item: BoardItem;
  projectId: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export function ChartItem({ item, projectId }: ChartItemProps) {
  const { data, loading, error, refresh } = useBoardQuery({
    itemId: item.id,
    projectId,
    autoFetch: true,
  });

  const chartType = item.payload.chart_type || 'bar';
  const chartConfig = item.payload.chart_config || {};
  const xAxis = chartConfig.x_axis;
  const yAxis = chartConfig.y_axis || [];

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data;
  }, [data]);

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64 text-destructive">
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p className="text-sm">No data available</p>
        </div>
      );
    }

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(yAxis) ? yAxis.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                />
              )) : <Line type="monotone" dataKey={yAxis} stroke={COLORS[0]} strokeWidth={2} />}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(yAxis) ? yAxis.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[idx % COLORS.length]}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.6}
                />
              )) : <Area type="monotone" dataKey={yAxis} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yAxis[0] || 'value'}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(yAxis) ? yAxis.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} />
              )) : <Bar dataKey={yAxis} fill={COLORS[0]} />}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.row_count} rows • Last updated: {new Date(data.executed_at).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {renderChart()}
    </div>
  );
}

