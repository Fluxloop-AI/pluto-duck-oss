'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { BoardItem } from '../../../lib/boardsApi';
import { useBoardQuery } from '../../../hooks/useBoardQuery';
import { Loader } from '../../ai-elements';

interface TableItemProps {
  item: BoardItem;
  projectId: string;
}

export function TableItem({ item, projectId }: TableItemProps) {
  const { data, loading, error, refresh } = useBoardQuery({
    itemId: item.id,
    projectId,
    autoFetch: true,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = item.payload.pagination?.page_size || 50;

  const paginatedData = useMemo(() => {
    if (!data?.data) return [];
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return data.data.slice(start, end);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil((data?.row_count || 0) / pageSize);

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

  if (!data || !data.columns || data.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {data.row_count} rows total • Page {currentPage} of {totalPages}
        </p>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted border-b border-border">
            <tr>
              {data.columns.map(col => (
                <th key={col} className="px-3 py-2 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="border-b border-border hover:bg-muted/50">
                {data.columns.map(col => (
                  <td key={col} className="px-3 py-2">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

